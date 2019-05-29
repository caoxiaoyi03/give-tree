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
 *
 * @typedef {import('./giveTreeNode')} GiveTreeNode
 */
const GiveTreeNode = require('./giveTreeNode')

/**
 * @typedef {import('@givengine/chrom-region')} ChromRegion
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
 * @alias module:DataNode
 * @extends {GiveTreeNode}
 * @property {Array<ChromRegion>} startList - A list of data entries
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
   * @param {Array<ChromRegion>} data - the sorted array of data
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
   * @param {ChromRegion} chrRange - DataNode should not handle
   *    this.
   * @param {Object} [props] - additional properties being passed onto nodes.
   * @param {Array<ChromRegion>} [props.continuedList] - the list of data
   *    entries that should not start in `chrRange` but are passed from the
   *    earlier regions, this will be useful for later regions if date for
   *    multiple regions are inserted at the same time
   * @param {function(ChromRegion):void} [props.callback] - the callback
   *    function to be used (with the data entry as its sole parameter) when
   *    inserting
   * @param {number} [props.dataIndex] - current index of `data` to start
   *    insertion. This is to optimize large insertions.
   *
   *    If this is specified, after insertion it will be moved to the first
   *    data entry whose `.start` is greater than `this.start`, if no
   *    such entry exists, it will be moved to `data.length`.
   *
   *    If this is not specified, after insertion, `data[0]` will become the
   *    first data entry whose `.start` is greater than `this.start`.
   *    Or `data` will become `[]` if no such entry exists.
   * @returns {DataNode} Always return `this`.
   */
  insert (data, chrRange, props) {
    // Steps:
    // 1. Push everything in `data` that has `start` value smaller than
    //    `this.start` into `continuedList`
    props = props || {}
    var currIndex =
      (typeof props.dataIndex === 'number' ? props.dataIndex : 0)
    var prevIndex = currIndex
    currIndex = this.constructor._traverseData(data, currIndex,
      dataEntry => dataEntry.start < this.start, props.callback)

    // 2. Check all `continuedList` to ensure they still overlap with `this`
    //    (getEnd() should be greater than `this.start`), remove those who
    //    don't, copy those who do to `this.continuedList`;
    props.continuedList = (props.continuedList || [])
      .concat(data.slice(prevIndex, currIndex))
      .filter(entry => entry.end > this.start)
    this.continuedList = props.continuedList.slice()

    // 3. Find all `data` entries that have same `start` value as `this`,
    //    and copy those to `this.startList`, move them from `data` to
    //    `continuedList`;
    prevIndex = currIndex
    currIndex = this.constructor._traverseData(data, currIndex,
      dataEntry => dataEntry.start === this.start, props.callback)
    this.startList = data.slice(prevIndex, currIndex)
    props.continuedList = props.continuedList.concat(this.startList)

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
   * @param  {(ChromRegion|GiveTreeNode)} data the data
   *    entry being removed.
   * @param  {boolean} exactMatch whether an exact match is needed
   *    to remove multiple data entries with the same start and end values.
   *
   *    If `true`, `data` will be compared by `.equalTo(data)` if exists,
   *    `===` if not. (this is done via calling
   *    `this.constructor._compareData(dataIn, dataEx)`)
   *
   *    If `false`, all entries matching the `start` value will be removed.
   * @param {boolean|null} [convertTo=null] what shall be used to replace
   *    the removed nodes, should be either `null` (default) or `false`.
   * @param  {Object} [props] additional properties being
   *    passed onto nodes.
   * @param {function(ChromRegion):void} [props.callback] the callback
   *    function to be used (with the data entry as its sole parameter) when
   *    deleting
   * @returns {GiveTreeNode|boolean}
   *    If the node itself shall be removed, return a falsey value to allow
   *    parents to take additional steps.
   */
  remove (data, exactMatch, convertTo, props) {
    props = props || {}
    if (data instanceof this.constructor && this.start === data.start && (
      (!exactMatch) || this.constructor._compareData(data, this)
    )) {
      // this node should be removed
      this.clear()
      return false
    }
    if (data.start === this.start) {
      this.startList = this.startList.filter(dataIn => {
        if (!exactMatch || this.constructor._compareData(data, dataIn)) {
          if (typeof props.callback === 'function') {
            props.callback(dataIn)
          }
          return false
        }
        return true
      })
    }
    this.continuedList = this.continuedList.filter(dataIn => {
      if (dataIn.start === data.start && (
        !exactMatch || this.constructor._compareData(data, dataIn)
      )) {
        if (typeof props.callback === 'function') {
          props.callback(dataIn)
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
   * When traversing, everything in 'continuedList' of *the starting record
   * only* will be processed first, then everything in 'startList' in all
   * overlapping records will be processed.
   *
   * @param  {ChromRegion} chrRange - the chromosomal range
   *    to traverse.
   * @param  {function} callback - the callback function, takes a
   *    `GIVE.ChromRegion` object as its sole parameter and returns
   *    something that can be evaluated as a boolean value to determine
   *    whether the call shall continue (if `breakOnFalse === true`).
   * @param  {function} [filter] - a filter function that takes a
   *    `GIVE.ChromRegion` object as its sole parameter and returns whether
   *    the region should be included in traverse.
   * @param  {boolean} [breakOnFalse=false] - whether the traverse should be
   *    stopped if `false` is returned from the callback function.
   * @param  {Object} [props] - additional properties being
   *    passed onto nodes.
   * @param  {boolean} [props.notFirstCall] - whether this is not the first
   *    call of a series of `traverse` calls.
   * @param  {...any} args - additional args being passed onto `callback`
   *    and `filter`
   * @returns {boolean} - whether future traverses should be conducted.
   */
  traverse (chrRange, callback, filter, breakOnFalse, props, ...args) {
    // helper function
    let callFunc = entry => {
      // First determine if `chrRange` exists and does not overlap
      // `dataEntry`. If so, return `true` to proceed with the next
      if (chrRange &&
        (chrRange.start >= entry.end || entry.start >= chrRange.end)
      ) {
        return true
      }
      // If `chrRange` does not exist or overlaps `dataEntry`
      // call `callback` and return its value (applying `filter` and
      // `breakOnFalse`).
      return this.constructor._callFuncOnDataEntry(callback, filter,
        breakOnFalse, entry, props, ...args)
    }
    // needs to traverse on continuedList if `!props.notFirstCall`
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
      node.updateContinuedList(this.continuedList.concat(this.startList))
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
   * Update the continued list (this happens mainly because of node merging)
   * @param {Array<ChromRegion>} continuedList
   * @param {boolean} [throwIfNotConsistent] Throw an error if the final
   *    `continuedList` is inconsistent with the original.
   * @returns {Array<ChromRegion>} return a list concatenated with
   *    `this.startList` as a base for future `continuedList`s
   */
  updateContinuedList (continuedList, throwIfNotConsistent) {
    if (continuedList) {
      continuedList = continuedList.filter(entry => (entry.end > this.start))
      if (throwIfNotConsistent &&
        this.continuedList.length > continuedList.length
      ) {
        throw new Error('ContinuedList inconsistent.')
      }
      this.continuedList = continuedList
    }
    return this.continuedList.concat(this.startList)
  }
}

module.exports = DataNode
