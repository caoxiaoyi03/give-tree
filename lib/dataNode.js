/**
 * @license
 * Copyright 2018-2019 The Regents of the University of California.
 * All Rights Reserved.
 *
 * Created by Xiaoyi Cao
 * Department of Bioengineering
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const GiveTreeNode = require('./giveTreeNode')
const ChromRegion = require('@givengine/chrom-region')

/**
 * @typedef {import('./giveTree')} GiveTree
 */

/**
 * @callback DataEntryCallback Callback function used on data entries
 * @param {ChromRegion} dataEntry The data entry in question
 * @param {ChromRegion} chrRange The ranges. This can be changed in the
 *  callback function to optimize traversing.
 * @param {object} [props] Property object for additional arguments.
 * @param {...object} args Additional arguments that may be handled in the
 *  callback
 * @returns {boolean} Used to break traversing if allowed, or as the filter
 *  flag.
 */

/**
 * @callback NodeCallback Callback function used on the entire node.
 * @param {GiveTreeNode} node The node entry in question.
 * @param {ChromRegion} chrRange The ranges. This can be changed in the
 *  callback function to optimize traversing.
 * @param {object} [props] Property object for additional arguments.
 * @param {...object} args Additional arguments that may be handled in the
 *  callback.
 * @returns {boolean} Used to break traversing if allowed, or as the filter
 *  flag, or to determine whether node callback should be used instead of data
 *  callback.
 */

/**
 * @module DataNode
 * Class for data storage.
 *
 * Every record will serve as a bin, with a start and end coordinate, and
 * all records combined will serve as a division of the chromosome (no gap,
 * no overlap) with all the start value for dividing points.
 *
 * For example:
 * ```
 * bins:   << |                      |       |          |       >>
 * Data:   << ------------]
 *            [-----------------]
 *            [------------]
 *            [------------------------------------]
 *            [--------------------------]
 *                                   [-------]
 *                                   [------------------------- >>
 *                                           [---------------]
 *                                           [----------------- >>
 *                                                      [-]
 * ```
 *
 * Records can have value of:
 *
 * `null`:   data not loaded yet, when upper layer encounter this, the
 *           code there needs to retrieve potential data;
 *
 * `false`:  there is no data in this bin;
 *
 * A `DataNode` instance:
 *           the instance of a class described in this file
 *
 * @class
 * @alias module:DataNode
 * @extends {GiveTreeNode}
 * @property {Array<ChromRegion>} startList - A sorted list of data entries
 *    that __start exactly at__ the start coordinate of this node.
 *    `startList` will become an empty array only if the previous bin is
 *    `null` (because otherwise this bin can be merged with the previous
 *    one), or this is the first bin of the storage unit;
 * @property {Array<ChromRegion>} continuedList - A list of data entries
 *    that __continue into__ the start coordinate of this node. This array
 *    will be sorted by the actual starting points, `[]` will have the same
 *    effect as `undefined`. This is used in `DataNode.traverse`
 *    only at the first node. See `DataNode.traverse` for details.
 */
class DataNode extends GiveTreeNode {
  /**
   * @constructor
   * @param {object} props - properties that will be passed to the
   *    individual implementations. For `GIVE.DataNode`, three properties
   *    will be used:
   * @param {number} props.start - for `this.start`
   * @param {Array<ChromRegion>} [props.startList] - for
   *    `this.startList`
   * @param {Array<ChromRegion>} [props.continuedList] - for
   *    `this.continuedList`
   */
  constructor (props) {
    super(props)
    this._start = props.start
    this.startList = props.startList || []
    this.continuedList = props.continuedList || []
  }

  /**
   * Implementing GIVE.GiveTreeNode methods
   */

  /**
   * Whether this data node has data stored. Because data node is populated with
   *    actual data, it will always return `true` (always has data).
   *
   * @type {boolean}
   */
  get hasData () {
    return true
  }

  get start () {
    return this._start
  }

  /**
   * Insert data under this node
   *
   * @param {Array<ChromRegion>} data The __sorted__ array of data
   *    entries (each should be an extension of `GIVe.ChromRegion`).
   *    `data === null` or `data === []` means there is no data in
   *    `chrRange` and `[]`s will be used in actual storage.
   *
   *    __NOTICE:__ any data overlapping `chrRange` should appear either
   *    here or in `continuedList`, otherwise `continuedList` in data
   *    entries may not work properly.
   *
   *    After insertion, any entry within `data` that has `.start` value
   *    larger than `this.start` will be deleted from the array or marked
   *    for deletion via `props.dataIndex`. See `props.dataIndex` for
   *    details.
   * @param {ChromRegion} chrRange DataNode should not handle this.
   * @param {object} [props] Additional properties being passed onto nodes.
   * @param {Array<ChromRegion>} [props.continuedList] The list of data
   *    entries that should not start in `chrRange` but are passed from the
   *    earlier regions, this will be useful for later regions if date for
   *    multiple regions are inserted at the same time
   * @param {DataEntryCallback} [props.dataCallback] The callback
   *    function to be used when inserting.
   * @param {number} [props.dataIndex] Current index of `data` to start
   *    insertion. This is to optimize large insertions.
   *
   *    If this is specified, after insertion it will be moved to the first
   *    data entry whose `.start` is greater than `this.start`, if no
   *    such entry exists, it will be moved to `data.length`.
   *
   *    If this is not specified, after insertion, `data[0]` will become the
   *    first data entry whose `.start` is greater than `this.start`.
   *    Or `data` will become `[]` if no such entry exists.
   * @param {boolean} [props.addNew] Whether data should be added to
   *    `this.startList` or replace everything inside.continuedList
   * @param {boolean} [props.allowDuplicates] Whether duplicated data should be
   *    allowed to exist. This might affect how data are removed.
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   * @returns {DataNode} Always return `this`.
   */
  insert (data, chrRange, props, ...args) {
    // Steps:
    // 1. Push everything in `data` that has `start` value smaller than
    //    `this.start` into `continuedList`
    props = props || {}
    var currIndex =
      (typeof props.dataIndex === 'number' ? props.dataIndex : 0)
    var prevIndex = currIndex
    currIndex = this.constructor._traverseData(data, currIndex, chrRange,
      dataEntry => dataEntry.start < this.start, props.dataCallback, props, ...args)

    // 2. Check all `continuedList` to ensure they still overlap with `this`
    //    (getEnd() should be greater than `this.start`), remove those who
    //    don't, copy those who do to `this.continuedList`;
    props.continuedList = (props.continuedList || [])
      .concat(data.slice(prevIndex, currIndex))
      .filter(entry => entry.end > this.start)
    this.continuedList = props.continuedList.slice()
    // Use this.continuedList to define `props._postInsertionOpRange`
    let maxEnd = props.continuedList.reduce(
      (currMax, curr) => (currMax < curr.end ? curr.end : currMax), this.start)
    props._postInsertionOpRange = new ChromRegion({
      chr: chrRange.chr,
      start: this.start,
      end: maxEnd
    })

    // 3. Find all `data` entries that have same `start` value as `this`,
    //    and copy those to `this.startList`, move them from `data` to
    //    `continuedList`;
    prevIndex = currIndex
    currIndex = this.constructor._traverseData(data, currIndex, chrRange,
      dataEntry => dataEntry.start === this.start,
      props.dataCallback, props, ...args)
    if (!props.addNew) {
      this.startList = data.slice(prevIndex, currIndex)
        .sort(ChromRegion.compare)
      this.startList.forEach(entry => {
        if (props._postInsertionOpRange.end < entry.end) {
          props._postInsertionOpRange.end = entry.end
        }
      })
    } else {
      // Add new data to existing data
      let newData = data.slice(prevIndex, currIndex)
      if (!props.allowDuplicates) {
        newData = newData.filter(dataEntry => !this.startList.some(
          startEntry => this.constructor._compareData(startEntry, dataEntry)
        ))
        newData.forEach(entry => {
          if (props._postInsertionOpRange.end < entry.end) {
            props._postInsertionOpRange.end = entry.end
          }
        })
      }
      this.startList = this.startList.concat(newData).sort(ChromRegion.compare)
    }
    props.continuedList = props.continuedList.concat(this.startList)
    props.continuedListUpdateBoundary = props.continuedList.reduce(
      (boundary, currNode) =>
        ((typeof currNode.end === 'number' && currNode.end > boundary)
          ? currNode.end : boundary),
      props.continuedListUpdateBoundary || this.start
    )

    if (typeof props.dataIndex !== 'number') {
      // remove data if props.currIndex is not specified
      data.splice(0, currIndex)
    } else {
      // update `props.currIndex`
      props.dataIndex = currIndex
    }

    return this
  }

  /**
   * Remove data entries from the node.
   *
   * Data entries with the same start will be removed. If multiple entries are
   * found with the same start, the behavior will be defined by `exactMatch`.
   *
   * @param {(ChromRegion|GiveTreeNode)} data the data
   *    entry being removed.
   * @param {object} props additional properties being
   *    passed onto nodes.
   * @param {DataEntryCallback} props.dataCallback the callback
   *    function to be used when deleting.
   * @param {boolean} exactMatch whether an exact match is needed
   *    to remove multiple data entries with the same start and end values.
   *
   *    If `true`, `data` will be compared by `.equalTo(data)` if exists,
   *    `===` if not. (this is done via calling
   *    `this.constructor._compareData(dataIn, dataEx)`)
   *
   *    If `false`, all entries matching the `start` value will be removed.
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   * @returns {GiveTreeNode|boolean}
   *    If the node itself shall be removed, return a falsey value to allow
   *    parents to take additional steps.
   */
  removeData (data, props, ...args) {
    if (data instanceof this.constructor && this.start === data.start && (
      (!props.exactMatch) || this.constructor._compareData(data, this)
    )) {
      // this node should be removed
      this.clear()
      return false
    }
    if (data.start === this.start) {
      this.startList = this.startList.filter(dataIn => {
        if (!props.exactMatch || this.constructor._compareData(data, dataIn)) {
          if (typeof props.dataCallback === 'function') {
            props.dataCallback(dataIn)
          }
          return false
        }
        return true
      })
    }
    this.continuedList = this.continuedList.filter(dataIn => {
      if (dataIn.start === data.start && (
        !props.exactMatch || this.constructor._compareData(data, dataIn)
      )) {
        if (typeof props.dataCallback === 'function') {
          props.dataCallback(dataIn)
        }
        return false
      }
      return true
    })
    return this.isEmpty ? false : this
  }

  clear (convertTo) {
    this.startList = []
    this.continuedList = []
  }

  /**
   * Traverse all nodes / data entries within `this` and calling
   *    functions on them.
   *
   * @param {ChromRegion} chrRange The chromosomal range
   *    to traverse.
   * @param {object} props Additional properties being
   *    passed onto nodes.
   * @param {NodeCallback} [props.nodeCallback] The callback function to be used
   *    on the entire node (that pass `nodeFilter` if it exists).
   * @param {NodeCallback} [props.nodeFilter] The filter function to be used,
   *    return `false` to exclude the entry from being called with
   *    `nodeCallback`.
   *
   *    Filtered entries will not break the traverse since `nodeCallback` will
   *    not be evaluated on them. But their children will still be evaluated.
   * @param {DataEntryCallback} [props.dataCallback] The callback function to be
   *    used on all overlapping data entries (that pass `dataFilter` if it
   *    exists).
   * @param {DataEntryCallback} [props.dataFilter] The filter function to be
   *    used, return `false` to exclude the entry from being called with
   *    `dataCallback`.
   *
   *    Filtered entries will not break the traverse since `dataCallback` will
   *    not be evaluated on them.
   * @param {boolean} [props.bothCalls] If set to `true` and both
   *    `props.nodeCallback` and `props.dataCallback` exists, then after
   *    evaluating `props.nodeCallback`, `props.dataCallback` will also be
   *    evaluated. Otherwise if `props.nodeCallback` is evaluated, no evaluation
   *    of `props.dataCallback` will happen.
   *
   *    If both `props.nodeCallback` and `props.dataCallback` are not defined,
   *    this parameter will have no effect.
   * @param {boolean} [props.notFirstCall] Whether this is not the first
   *    call of a series of `traverse` calls.
   * @param {boolean} [props.breakOnFalse=false] Whether the traverse should be
   *    stopped if `false` is returned from any callback function.
   * @param  {...*} [args] Additional arguments that will be passed to
   *    `callback` and `filter`
   * @returns {boolean} Whether future traverses should be conducted.
   */
  _traverseChildren (chrRange, props, ...args) {
    if (typeof props.dataCallback !== 'function') {
      return true
    }
    // helper function
    let callFunc = entry => {
      // First determine if `chrRange` exists and does not overlap
      // `dataEntry`. If so, return `true` to proceed with the next
      if (chrRange.start >= entry.end || entry.start >= chrRange.end) {
        return true
      }
      // If `chrRange` does not exist or overlaps `dataEntry`
      // call `callback` and return its value (applying `filter` and
      // `breakOnFalse`).
      return this.constructor._callFuncOnDataEntry(props.dataCallback,
        props.dataFilter, props.breakOnFalse, entry, chrRange, props, ...args)
    }
    // Needs to traverse on continuedList if `!props.notFirstCall`
    if (!props.notFirstCall) {
      if (!this.continuedList.every(callFunc)) {
        return false
      }
    }
    props.notFirstCall = true
    return this.startList.every(callFunc)
  }

  hasUncachedRange (chrRange, props) {
    return false
  }

  getUncachedRange (chrRange, props) {
    return (props || {})._result || []
  }

  /**
   * Merge this node with `node`.
   *
   * If `node` doesn't have any data or anything in `startList`, merge.
   * Actually because of the structure of `GIVE.DataNode`, nothing needs
   *    to be changed in `this` if merge is successful. Just return `true`
   *    to let the caller handle `node`.
   *
   * @param  {DataNode|boolean|null} node - node to be merged.
   *    Note that this node has to be positioned after `this`.
   * @returns {boolean}      whether the merge is successful
   */
  mergeAfter (node) {
    if (node === false || (
      node instanceof this.constructor && node.startList.length <= 0
    )) {
      return true
    } else if (node instanceof this.constructor) {
      // the node is not mergable, but its continuedList may be updated
      node._updateContinuedList(this.continuedList.concat(this.startList))
    }
    return false
  }

  /**
   * Whether this node is empty.
   *
   * If there is no entry in both `this.startList` and `this.continuedList` then
   *    the node is considered empty.
   *
   * @type {boolean}
   */
  get isEmpty () {
    return this.startList.length <= 0 && this.continuedList.length <= 0
  }

  /**
   * Whether this node has an empty `startList`.
   *
   * This will be considered as empty if the tree is a local-only one.
   *
   * @type {boolean}
   */
  get hasEmptyStart () {
    return this.startList.length <= 0
  }

  /**
   * Update the continued list (this happens mainly because of node merging
   * and insertion). The (sort-of) reverse operation of
   * `this.constructor.updateExtContinuedList`
   * @param {Array<ChromRegion>} [continuedList]
   * @param {boolean} [throwIfNotConsistent] Throw an error if the final
   *    `continuedList` is inconsistent with the original.
   * @returns {Array<ChromRegion>} return a list concatenated with
   *    `this.startList` as a base for future `continuedList`s
   */
  _updateContinuedList (extList, throwIfNotConsistent) {
    if (extList) {
      for (let i = 0; i < extList.length; i++) {
        if (extList[i].end <= this.start) {
          extList.splice(i, 1)
          i--
        }
      }
      if (throwIfNotConsistent &&
        this.continuedList.length > extList.length
      ) {
        throw new Error('ContinuedList inconsistent.')
      }
      let selfIndex = 0
      let extIndex = 0
      while (selfIndex < this.continuedList.length &&
        extIndex < extList.length
      ) {
        let compareResult = ChromRegion.compare(
          this.continuedList[selfIndex], extList[extIndex])
        if (compareResult < 0) {
          selfIndex++
        } else if (compareResult > 0) {
          extIndex++
        } else {
          this.continuedList[selfIndex] = extList[extIndex]
          selfIndex++
          extIndex++
        }
      }
    }
    return this.continuedList.concat(this.startList)
  }

  /**
   * Post insertion operation API for leaf nodes.
   * If this is defined, it will be called after the main insertion is done
   * @param {DataNode} node Node to be updated
   * @param {ChromRegion} chrRange Chromosome region that will be affected
   * @param {object} props Properties passed from `GiveTree.traverse`
   * @param {Array<ChromRegion>} extList External list as source of truth
   *   to be updated in `node`.
   * @returns {Array<ChromRegion>} A new `continuedList` to be used on future
   *   nodes.
   */
  static postInsertOp (node, chrRange, props, extList) {
    return node._updateContinuedList(extList)
  }

  /**
   * Synchronize `continuedList`, replacing external data with stored data
   * @static
   * @param {ChromRegion} dataEntry Data entry stored in node
   * @param {ChromRegion} syncRange Range of synchronizing operation
   * @param {object} props Additional props.
   * @param {Array<ChromRegion>} preSyncExtList List before sync.
   * @param {Array<ChromRegion>} extList List after sync.
   */
  static _updateExtContinuedList (
    dataEntry, syncRange, props, preSyncExtList, extList
  ) {
    if (preSyncExtList.length) {
      if (preSyncExtList[0].start < dataEntry.start) {
        throw new Error('ContinuedList inconsistent: entry ' +
          preSyncExtList[0].toString() + ' does not exist before ' +
          'existing entry ' + dataEntry.toString() + '!')
      }
      if (dataEntry.equalTo(preSyncExtList[0])) {
        extList.push(dataEntry)
        preSyncExtList.shift()
        syncRange.start = preSyncExtList.length
          ? Math.min(preSyncExtList[0].start, syncRange.end)
          : syncRange.end
      }
    }
  }

  /**
   * Pre-insertion operation
   *
   * This implementation will merge all data overlapping `chrRange.start`
   * with `props.continuedList`, then replace anything within
   * `props.continuedList` by `DataNode`s already in the tree (search from the
   * smallest `.start` value within `props.continuedList` to `chrRange.start`)
   *
   * @param {Array<ChromRegion>} data
   * @param {ChromRegion} insertRange Range for the insertion.
   * @param {GiveTree} tree `GiveTree` doing the insertion.
   * @param {object} props Additional props.
   * @param {Array<ChromRegion>} props.continuedList
   * @param {DataEntryCallback} [props.dataCallback]
   * @param  {...*} [args] Additional arguments that will be passed to
   *    `callback`
   */
  static preInsertionOp (data, insertRange, tree, props, ...args) {
    // 1. Merge all proper data to `props.continuedList`
    let _preInsContinuedList = props.continuedList.slice()
    for (let i = 0; i < data.length; i++) {
      if (data[i].start < insertRange.start) {
        if (data[i].overlaps(insertRange)) {
          _preInsContinuedList.push(data[i])
        }
        data.splice(i, 1)
        i--
      }
    }
    _preInsContinuedList = _preInsContinuedList.sort(ChromRegion.compare)
    // 2. Replace `props.continuedList`
    let preInsertionRange = tree.coveringRange.getMinus(insertRange)[0]
    props.continuedList.length = 0
    if (preInsertionRange) {
      tree.traverse(preInsertionRange, {
        dataCallback: this._updateExtContinuedList.bind(this),
        allowNull: true
      }, _preInsContinuedList, props.continuedList)
    }
    if (_preInsContinuedList.length) {
      if (typeof props.dataCallback === 'function') {
        _preInsContinuedList.forEach(
          entry => props.dataCallback(entry, insertRange, props, ...args))
      }
      props.continuedList.push(..._preInsContinuedList)
    }
  }
}

module.exports = DataNode
