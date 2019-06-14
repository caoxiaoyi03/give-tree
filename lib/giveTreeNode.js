/**
 * @license
 * Copyright 2017-2019 The Regents of the University of California.
 * All Rights Reserved.
 *
 * Created by Xiaoyi Cao
 * Department of Bioengineering
 *
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
 * @module GiveTreeNode
 * @exports GiveTreeNode
 * @typedef {import('@givengine/chrom-region')} ChromRegion
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
 * @callback PreInsertionOperations Function used on before insertion operation
 * to ensure data consistency.
 *
 * @param {Array<ChromRegion>} data Sorted array of data.
 * @param {ChromRegion} insertRange Range for the insertion.
 * @param {GiveTree} tree `GiveTree` doing the insertion.
 * @param {object} props Additional props.
 */

/**
 * Node interface for GIVE Trees
 *
 * @class
 * @alias module:GiveTreeNode
 * @abstract
 * @property {PreInsertionOperations} preInsertionOp Pre-insertion operations
 * used to ensure data consistency.
 */
class GiveTreeNode {
  /**
   * Whether this data node has data stored. Return `true` if the data is ready,
   *    otherwise `false`.
   *
   * Return `false` by default since this basic implementation does not
   *    include summaries.
   *
   * @type {boolean}
   */
  get hasData () {
    return false
  }

  /**
   * The start coordinate of the region covered by this node.
   * @type {number}
   */
  get start () {
    throw new Error('GiveTreeNode.start not implemented in `' +
      this.constructor.name + '`!')
  }

  set start (newStart) {
    throw new Error('GiveTreeNode.start gets called but has not ' +
      'been implemented in `' + this.constructor.name + '`.')
  }

  /**
   * The end coordinate.
   * @type {number}
   */
  get end () {
    throw new Error('GiveTreeNode.end not implemented in `' +
      this.constructor.name + '`!')
  }

  set end (newEnd) {
    throw new Error('GiveTreeNode.end gets called but has not ' +
      'been implemented in `' + this.constructor.name + '`.')
  }

  /**
   * Insert data under this node
   *
   * @abstract
   *
   * @param {Array<ChromRegion>} data The sorted array of
   *    data entries (each should be an extension of `GIVe.ChromRegion`).
   *    `data === null` or `data === []` means there is no data in
   *    `chrRange` and `false`s will be used in actual storage.
   *
   *    __NOTICE:__ any data overlapping `chrRange` should appear either
   *    here or in `continuedList`, otherwise `continuedList` in data
   *    entries may not work properly.
   *
   *    After insertion, any entry within `data` that overlaps `chrRange`
   *    will be deleted from the array __unless `props.currIndex` is
   *    provided__ in the parameter, see `props.currIndex` below.
   * @param {ChromRegion} chrRange The chromosomal range
   *    that `data` corresponds to.
   *
   *    This is used to mark the empty regions correctly. No `null` will
   *    present within these regions after this operation.
   *
   *    This parameter should be an `Object` with at least two properties:
   *    `{ start: <start coordinate>, end: <end coordinate>, ... }`,
   *    preferably a `ChromRegion` object.
   * @param {object} props Additional properties being
   *    passed onto nodes.
   * @param {Array<ChromRegion>} [props.continuedList]
   *    the list of data entries that should not start in `chrRange` but are
   *    passed from the earlier regions, this will be useful for later regions
   *    if date for multiple regions are inserted at the same time.
   * @param {DataEntryCallback} [props.dataCallback] The callback
   *    function to be used when inserting.
   * @param {function(new:GiveTreeNode)} [props.LeafNodeCtor] The constructor
   *    function of leaf nodes if they are not the same as the non-leaf nodes.
   * @param {number} [props.dataIndex] The current index of `data`.
   *    If this is specified, no array splicing will be done on `data` to
   *    improve performance. `props.currIndex` will be shifted (and passed
   *    back).
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   * @returns {GiveTreeNode}
   *    Return `this`.
   *    This is reserved for tree structures that may change after
   *    insertion. For example, auto-balancing trees may return multiple
   *    entries, indicating siblings being created.
   */
  insert (data, chrRange, props, ...args) {
    throw new Error('GiveTreeNode.insert not implemented in `' +
      this.constructor.name + '`!')
  }

  /**
   * Remove data entries from the node.
   *
   * @abstract
   *
   * Data entries with the same start (and end values if exists) will be
   * removed. If multiple entries are found with the same start (and end
   * values), the behavior will be defined by `exactMatch`.
   *
   * __NOTE:__ No restructuring will happen during this step even if
   * auto-balancing is supported (due to performance reasons). The `tree` shall
   * call `this._root = this._root.restructure()` after removing nodes.
   *
   * @param {(ChromRegion|GiveTreeNode)} data The data
   *    entry being removed.
   * @param {object} props Additional properties being
   *    passed onto nodes.
   * @param {DataEntryCallback} [props.dataCallback] The callback
   *    function to be used when deleting.
   * @param {boolean} [props.exactMatch] Whether an exact match is needed
   *    to remove multiple data entries with the same start and end values.
   *
   *    If `true`, `data` will be compared by `.equalTo(data)` if exists,
   *    `===` if not. (this is done via calling
   *    `this.constructor._compareData(dataIn, dataEx)`)
   *
   *    If `false`, all entries matching the `start` and `end` values will be
   *    removed.
   * @param {boolean|null} [props.convertTo=null] What shall be used to replace
   *    the removed nodes, should be either `null` (default) or `false`.
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   * @returns {GiveTreeNode|boolean}
   *    If the node itself shall be removed, return a falsey value to allow
   *    parents to take additional steps.
   */
  remove (data, props, ...args) {
    throw new Error('GiveTreeNode.remove not implemented in `' +
      this.constructor.name + '`!')
  }

  /**
   * Compare an internal data entry with an external entry.
   *
   * @static
   * @param  {ChromRegion|GiveTreeNode} dataEx The
   *    external data entry.
   * @param  {ChromRegion|GiveTreeNode} dataIn The
   *    internal data entry.
   * @returns {boolean} whether the two data entries match.
   */
  static _compareData (dataEx, dataIn) {
    return dataIn &&
      ((typeof dataIn.equalTo === 'function' && dataIn.equalTo(dataEx)) ||
      dataIn === dataEx)
  }

  /**
   * Clear everything within this node and make it empty (basic
   *    properties should still be retained).
   * @param {boolean|null} [convertTo=null] What shall be used to replace the
   *    removed contents, should be either `null` (default) or `false`.
   */
  clear (convertTo) {
    throw new Error('GiveTreeNode.remove not implemented in `' +
      this.constructor.name + '`!')
  }

  /**
   * Helper function: find `entries` in `data` that returns `true` with
   *  `critFunc.call(thisVarCriteria, entry)`, call `callback` on
   *  `entry` if `callback` exists and advance `currIndex`.
   *
   * @static
   * @param {Array<ChromRegion>} data The data array to be
   *    traversed
   * @param {number} currIndex Starting index
   * @param {ChromRegion} chrRange `ChromRegion` object used for traversing
   *    range. This can be changed by callback function
   * @param {DataEntryCallback} critFunc Function to decide
   *    whether data meets some criteria.
   * @param {DataEntryCallback} [callback] Function to be called
   *    upon all data entries that meet the criteria
   * @param {object} props Additional properties being passed onto callbacks.
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   * @returns {number} the index of the first entry that does not meet the
   *    criteria
   */
  static _traverseData (
    data, currIndex, chrRange, critFunc, callback, props, ...args
  ) {
    // Helper function: find `entries` in `data` that returns `true` with
    //    `critFunc.call(thisVarCriteria, entry)`, call `callback` on
    //    `entry` if `callback` exists and advance `currIndex`.

    while (
      currIndex < data.length && critFunc(
        data[currIndex], chrRange, props, ...args)
    ) {
      if (typeof callback === 'function') {
        callback(data[currIndex], chrRange, props, ...args)
      }
      currIndex++
    }
    return currIndex
  }

  /**
   * Helper function to call `callback` on data entries.
   *
   * @static
   * @param  {ChromRegion|null} [chrRange] The chromosomal
   *    range, if provided, data should overlap with chrRange to be called.
   * @param  {DataEntryCallback|NodeCallback} callback The callback function
   *    whose return value can be evaluated as a boolean value to determine
   *    whether the call shall continue (if `breakOnFalse === true`).
   * @param  {DataEntryCallback|NodeCallback} [filter] A filter function that
   *    returns whether the region should be included in traverse.
   * @param  {boolean} [returnFalse=false] Whether this function should return
   *    `false` if `callback` returns `false`.
   * @param  {ChromRegion|GiveTreeNode} entry The data
   *    entry `callback` is going to be called upon.
   * @param  {ChromRegion} chrRange `ChromRegion` object used for traversing
   *    range. This can be changed by callback function.
   * @param  {object} [props] Additional properties being
   *    passed onto nodes.
   * @param  {boolean} [props.notFirstCall] Whether this is not the first
   *    call of a series of `traverse` calls.
   * @param  {...object} [args] Additional args being passed onto `callback`
   *    and `filter`
   * @returns {boolean} Whether future traverses should be conducted.
   */
  static _callFuncOnDataEntry (
    callback, filter, returnFalse, entry, chrRange, props, ...args
  ) {
    if (typeof filter === 'function' &&
      !filter(entry, chrRange, props, ...args)
    ) {
      return true
    }
    return callback(entry, chrRange, props, ...args) || !returnFalse
  }

  /**
   * Traverse all nodes / data entries within `this` and calling
   *    functions on them.
   *
   * @abstract
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
   * @param {boolean} [props.allowNull] Whether this traverse will skip `null`
   *    nodes instead of throwing an exception. __NOTE__: when skipping `null`,
   *    `props.notFirstCall` will be marked as `false`.
   * @param {boolean} [props.breakOnFalse=false] Whether the traverse should be
   *    stopped if `false` is returned from any callback function.
   * @param  {...*} [args] Additional arguments that will be passed to
   *    `callback` and `filter`
   * @returns {boolean} Whether future traverses should be conducted.
   */
  traverse (chrRange, props, ...args) {
    let result = true
    // First determine if `nodeCallback` shall be used
    if (typeof props.nodeCallback === 'function') {
      if (typeof props.nodeFilter !== 'function' ||
        props.nodeFilter(this, chrRange, props, ...args)
      ) {
        result = props.nodeCallback(this, chrRange, props, ...args)
        if (!props.bothCalls || typeof props.dataCallback !== 'function' ||
          (!result && props.breakOnFalse)
        ) {
          return result
        }
      }
    }
    // Then continue towards children if `dataCallback` is defined
    return this._traverseChildren(chrRange, props, ...args)
  }

  _traverseChildren (chrRange, props, ...args) {
    throw new Error('GiveTreeNode.traverse not implemented in `' +
      this.constructor.name + '`!')
  }

  /**
   * Return an array of chrRegions that does not have
   *    data loaded to allow buffered loading of data
   *
   * @param  {ChromRegion} chrRange The range of query.
   * @param  {object} props Additional properties being passed onto
   *    nodes
   * @returns {Array<ChromRegion>} An ordered array of the
   *    regions that does not have the data at the current resolution
   *    requirement. If no such range is needed, return `[]`
   */
  getUncachedRange (chrRange, props) {
    throw new Error('GiveTreeNode.getUncachedRange not ' +
      'implemented in `' + this.constructor.name + '`!')
  }

  /**
   * Quickly check if the node has any uncached range
   *    within a specific range.
   *
   * @param  {ChromRegion} chrRange The range of query.
   * @param  {object} props Additional properties being passed onto
   *    nodes
   * @returns {boolean} `true` if the tree has uncached ranges.
   */
  hasUncachedRange (chrRange, props) {
    throw new Error('GiveTreeNode.hasUncachedRange not ' +
      'implemented in `' + this.constructor.name + '`!')
  }

  /**
   * Whether this node is empty (meaning no data is covered
   *    by the tree, and the entire range is already loaded)
   *
   * @type {boolean}
   */
  get isEmpty () {
    throw new Error('GiveTreeNode.isEmpty not implemented in `' +
      this.constructor.name + '`!')
  }

  /**
   * Merge `this` with the node after `this` (if possible). This method shall
   * be implemented if nodes are mergable.
   *
   * @param {GiveTreeNode|boolean|null} node
   * @returns {boolean}
   * @memberof GiveTreeNode
   */
  mergeAfter (node) {
    return false
  }
}

module.exports = GiveTreeNode
