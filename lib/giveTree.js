/**
 * @license
 * Copyright 2017-2019 The Regents of the University of California.
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
 * @module GiveTree
 * @exports GiveTree
 * @typedef {import('./giveTreeNode')} GiveTreeNode
 */

const WitheringMixin = require('./witheringMixin')
const ChromRegion = require('@givengine/chrom-region')
const GiveNonLeafNode = require('./giveNonLeafNode')
const GiveTreeNode = require('./giveTreeNode')

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
 * Object for data storage, most likely a tree of some sort
 * @class
 * @alias module:GiveTree
 * @abstract
 */
class GiveTree {
  /**
   * @constructor
   *
   * @param {ChromRegion} chrRange The range this data
   *    storage unit will be responsible for.
   * @param {object} [props] Properties that will be passed to the
   *    individual implementations
   * @param {number} [props.lifeSpan] Whether this tree shall wither.
   *    To disable withering, set `props.lifeSpan` to 0 or a negative value.
   * @param {function(new:GiveNonLeafNode)} [NonLeafNodeCtor]
   *    Constructor for `this._root`
   * @param {function(new:GiveTreeNode)} [props.LeafNodeCtor]
   *    if omitted, the constructor of `this.root` will be used
   * @param {boolean} [props.localOnly] Whether this tree allows live
   *    updating of its content (CUD operations), if this is `true`,
   *    withering will be disabled and `props.lifeSpan` will be ignored.
   */
  constructor (chrRange, props) {
    props = props || {}
    let NonLeafNodeCtor =
      props.NonLeafNodeCtor || this.constructor.DefaultNonLeafNodeCtor
    this._initProperties(chrRange, NonLeafNodeCtor, props)
    if (!GiveTreeNode.prototype.isPrototypeOf(
      this._LeafNodeCtor.prototype
    )) {
      throw new Error('LeafNodeCtor `' + this._LeafNodeCtor +
        '` is not an IMPLEMENTED constructor for a tree node!')
    }
    if (!GiveNonLeafNode.prototype.isPrototypeOf(
      NonLeafNodeCtor.prototype
    )) {
      throw new Error('NonLeafNodeCtor `' + NonLeafNodeCtor +
        '` is not a constructor for a non-leaf tree node!')
    }
    props.start = chrRange.start
    props.end = chrRange.end
    props.tree = this
    props.isRoot = true
    if (!this.localOnly &&
      ((typeof props.lifeSpan === 'number' && props.lifeSpan > 0) ||
        (typeof props.lifeSpan !== 'number' && !props.lifeSpan))
    ) {
      props.lifeSpan = props.lifeSpan || this.constructor.DEFAULT_LIFE_SPAN
      /**
       * Current generation of the tree
       * @type {number|undefined}
       * @memberof GiveTree#
       */
      this._currGen = 0
      /**
       * Lifespan for all nodes in the tree
       * @type {number|undefined}
       * @memberof GiveTree#
       */
      this.lifeSpan = props.lifeSpan
      /**
       * Root node object
       * @type {GiveNonLeafNode}
       * @memberof GiveTree#
       */
      this._root = new (WitheringMixin(NonLeafNodeCtor))(props)
      /**
       * Promise for withering operations.
       * @type {Promise|null}
       * @memberof GiveTree#
       */
      this._witheringPromise = null
      /**
       * Promise for queued withering-related operations.
       * @type {Promise|null}
       * @memberof GiveTree#
       */
      this._pendingWitheringPromise = null
    } else {
      this._currGen = null
      this._root = new NonLeafNodeCtor(props)
    }
  }

  /**
   * Initialize properties of GiveTree.
   *
   * @param {ChromRegion} chrRange The range this data
   *    storage unit will be responsible for.
   * @param {function(new:GiveNonLeafNode)} NonLeafNodeCtor Constructor for
   *    `this._root`
   * @param {object} [props] Properties that will be passed to the
   *    individual implementations
   * @param {function(new:GiveTreeNode)} [props.LeafNodeCtor] If omitted, the
   *    constructor of `this.root` will be used
   * @param {boolean} [props.localOnly] Whether this tree allows live
   *    updating of its content (CUD operations), if this is `true`,
   *    withering will be disabled and `props.lifeSpan` will be ignored.
   */
  _initProperties (chrRange, NonLeafNodeCtor, props) {
    /**
     * Chromosome that this data storage unit is for
     * @type {string}
     * @memberof GiveTree#
     */
    this.chr = chrRange.chr
    /**
     * Constructor for all leaf nodes
     * @type {function(new:GiveTreeNode)}
     * @memberof GiveTree#
     */
    this._LeafNodeCtor = props.LeafNodeCtor ||
      this.constructor.DefaultLeafNodeCtor ||
      NonLeafNodeCtor
    this.localOnly = !!props.localOnly
  }

  /**
   * Whether nodes in the tree will have links to their siblings
   * @type {boolean}
   * @readonly
   */
  get neighboringLinks () {
    return !!this.constructor.neighboringLinks
  }

  get coveringRange () {
    return this._root.coveringRange
  }

  /**
   * Insert data entries within a single range.
   *
   * Procedures:
   * 1. Do pre-insertion operations to ensure data consistency if needed.
   *    The node shall implement `this._preInsertion` for it to work.
   * 2. Do the actual insertion.
   *
   * Please refer to `this.insert` for parameter annotation
   *
   * @param {Array<ChromRegion>} data
   * @param {ChromRegion} [chrRange]
   *    the chromosomal range that `data` corresponds to.
   * @param {object} [props]
   * @param {Array<ChromRegion>} [props.continuedList]
   * @param {DataEntryCallback} [props.callback]
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   */
  _insertSingleRange (data, chrRange, props, ...args) {
    // Procedures:
    // 1. Do pre-insertion operations to ensure data consistency if needed (if
    //    `prop._preInsertion` exists).
    //    The node shall implement `this._preInsertionOp` for it to work.
    // 2. Do the actual insertion in `GiveTreeNode.insert`.
    if (!chrRange || !chrRange.chr || chrRange.chr === this.chr) {
      props = props || {}
      props.continuedList = props.continuedList || []
      props.addNew = this.localOnly
      props.LeafNodeCtor = props.LeafNodeCtor || this._LeafNodeCtor
      chrRange = chrRange
        ? this._root.truncateChrRange(chrRange, true, false)
        : (data.length === 1 ? data[0] : this.coveringRange)
      this._preInsertionOp(data, chrRange, props)
      this._root = this._root.insert(data, chrRange, props)
    }
  }

  /**
   * Pre-insertion operation to ensure data consistency. This will be run if
   * there is a static function called `preInsertionOp` on `this._LeafNodeCtor`.
   *
   * @memberof GiveTree#
   */
  _preInsertionOp (data, chrRange, props) {
    if (typeof this._LeafNodeCtor.preInsertionOp === 'function') {
      props.doNotWither = true
      return this._LeafNodeCtor.preInsertionOp(data, chrRange, this, props)
    }
  }

  /**
   * Insert data entries within chromosomal range(s)
   *
   * @param {Array<ChromRegion>} data The array of
   *    data entries (each should be an extension of `ChromRegion`).
   *
   *    `data === null` or `data === []` means there is no data in
   *    `chrRange` and `false`s will be used in actual storage.
   *
   *    __NOTE:__ any data overlapping `chrRange` should appear either
   *    here or in `continuedList`, __but not both__, otherwise `continuedList`
   *    in data entries may not work properly.
   *
   *    __NOTE:__ This array will be changed after calling `insert`: it will be
   *    sorted first, then the ones that are already inserted will be removed.
   *
   * @param {Array<ChromRegion>|ChromRegion} [chrRanges]
   *    The array of chromosomal range(s) that `data` corresponds to.
   *    This is used to mark the empty regions correctly. No `null` will
   *    present within these regions after this operation.
   *
   *    The elements of this parameter should be an `Object` with at least
   *    two properties:
   *
   *    `{ start: <start coordinate>, end: <end coordinate>, ... }`,
   *    preferably a `ChromRegion` object.
   *
   *    If `data.length === 1` and `chrRange === null`, then
   *    `chrRegion = data[0]` because of ChromRegion behavior.
   *
   * @param {Array<Object>|Object} [props] Additional properties being
   *    passed onto nodes. If this is an `Array`, it should have the same
   *    `length` as `chrRanges` does.
   * @param {Array<ChromRegion>} [props.continuedList] The
   *    list of data entries that should not start in `chrRange` but are passed
   *    from the earlier regions, this will be useful for later regions if data
   *    for multiple regions are inserted at the same time.
   * @param {DataEntryCallback} [props.dataCallback] The callback function to be
   *    used on inserted data entries when inserting.
   * @param {boolean} [props.doNotWither=false] If `true`, the tree will not
   *    advance its generation or trigger withering.
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   * @param {function(new:GiveTreeNode)} [props.LeafNodeCtor] The constructor
   *    function of leaf nodes if they are not the same as the non-leaf nodes.
   */
  insert (data, chrRanges, props, ...args) {
    let exceptions = []
    if (!data || !Array.isArray(data)) {
      throw (new Error('Data is not an array! ' +
        'This will cause problems in continuedList.'))
    }

    data.sort(ChromRegion.compare)

    if (this.localOnly) {
      this._insertSingleRange(data, this.coveringRange,
        Array.isArray(props) ? props[0] : props, ...args)
    } else {
      chrRanges = chrRanges || data
      if (!Array.isArray(chrRanges)) {
        chrRanges = [chrRanges]
      }
      let uncachedProps = {}
      let uncachedRanges = chrRanges.reduce(
        (uncachedRanges, range) => this.getUncachedRange(range, uncachedProps),
        []
      )
      uncachedRanges.forEach((range, index) => {
        try {
          this._insertSingleRange(data, range,
            Array.isArray(props) ? props[index] : props, ...args)
        } catch (err) {
          err.message = '[insert] ' + err.message +
          '\nRange: ' + range.regionToString() +
          '\nData (first 3): ' + JSON.stringify(data.slice(0, 3)) +
          '\nStack: ' + err.stack
          exceptions.push(err)
          return null
        }
      })
      if (exceptions.length > 0) {
        let message = exceptions.reduce(
          (prevMessage, currErr) => (prevMessage + '\n' + currErr.message),
          'Exception occured during insertion:'
        )
        throw new Error(message)
      }
    }
  }

  /**
   * Removing a single data entry.
   *
   * @param {ChromRegion} data The data that needs to be removed.
   * @param {object} [props] Additional properties being passed onto
   *    nodes
   * @param {DataEntryCallback} [props.dataCallback] The callback function to be
   *    used when the data entry is/entries are being removed.
   * @param {boolean} [props.exactMatch=false] Whether an exact match is needed
   *    to remove the entry. If `true`, then `.equalTo(data)` method (if
   *    exists within the data entry) or `===` (if no `equalTo` method
   *    exists) will be used to evaluate whether a data entry should be
   *    removed. If `false`, then all data entries at the same location
   *    (start and end) will be removed.
   * @param {boolean|null} [props.convertTo=null] What shall be used to replace
   *    the removed nodes, should be either `null` (default) or `false`.
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   */
  remove (data, props, ...args) {
    props = props || {}
    if (props.convertTo === undefined) {
      props.convertTo = null
    }
    this._root.remove(data, props, ...args)
    this._root = this._root.restructure()
  }

  _advanceGenSync (amount) {
    this._currGen += (amount || 1)
    if (this._currGen >= this.constructor.MAX_GENERATION) {
      this._currGen = 0
    }
  }

  _advanceGen (amount) {
    if (this._currGen !== null) {
      if (!this._witheringPromise) {
        this._advanceGenSync(amount)
      } else {
        this._pendingWitheringPromise =
          (this._pendingWitheringPromise || this._witheringPromise)
            .then(() => this._advanceGenSync(amount))
      }
    }
  }

  _witherSync () {
    this._root.wither()
    this._root = this._root.restructure()
  }

  _wither () {
    if (this._currGen !== null) {
      if (!this._witheringPromise) {
        this._witheringPromise = Promise.resolve()
          .then(() => this._witherSync())
          .then(() => this._updateWitherPromise())
      } else {
        this._pendingWitheringPromise =
          (this._pendingWitheringPromise || this._witheringPromise)
            .then(() => this._witherSync())
      }
    }
  }

  _updateWitherPromise () {
    if (this._pendingWitheringPromise) {
      this._witheringPromise = this._pendingWitheringPromise
        .then(() => this._updateWitherPromise())
      this._pendingWitheringPromise = null
    } else {
      this._witheringPromise = null
    }
  }

  /**
   * Traverse given chromosomal range to apply functions to all
   * overlapping data entries.
   *
   * @param {ChromRegion} chrRange The chromosomal range
   *    to traverse. If omitted or falsey value is supplied, use the entire
   *    range.
   * @param {object} [props] Additional properties being passed onto
   *    nodes
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
   * @param {boolean} [props.doNotWither] If `true`, the tree will not advance
   *    its generation or trigger withering.
   * @param {boolean} [props.breakOnFalse=false] Whether the traversing should
   *    break if `false` has been returned from one of the `callback`s.
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   * @returns {boolean} If the traverse breaks on `false`, returns `false`,
   *    otherwise `true`
   */
  traverse (chrRange, props, ...args) {
    props = props || {}
    if (!chrRange || !chrRange.chr || chrRange.chr === this.chr) {
      // implement withering parts:
      // 1. Advance `this._currGen` by 1
      if (!props.doNotWither) {
        this._advanceGen()
      }
      try {
        chrRange = chrRange
          ? this._root.truncateChrRange(chrRange, true, false)
          : this.coveringRange
        return this._traverse(chrRange, props, ...args)
      } finally {
        // 2. try to find any child that is too old
        //    (`this._currGen - birthGen > this.lifeSpan`) and remove them.
        if (!props.doNotWither) {
          this._wither()
        }
      }
    }
    return true
  }

  /**
   * The actual function doing the traversing and should be overriden by sub
   * classes.
   *
   * @param {ChromRegion} chrRange The chromosomal range
   *    to traverse. If omitted or falsey value is supplied, use the entire
   *    range.
   * @param {object} props Additional properties being passed onto
   *    nodes
   * @param {NodeCallback} [props.nodeCallback] The callback function to be used
   *    on the entire node (that pass `nodeFilter` if it exists).
   * @param {NodeCallback} [props.nodeFilter] The filter function to be used,
   *    return `false` to exclude the entry from being called with `callback`.
   * @param {DataEntryCallback} [props.dataCallback] The callback function to be
   *    used on all overlapping data entries (that pass `dataFilter` if it
   *    exists).
   * @param {DataEntryCallback} [props.dataFilter] The filter function to be
   *    used, return `false` to exclude the entry from being called with
   *    `callback`.
   * @param {boolean} [props.bothCalls] If set to `true` and both
   *    `props.nodeCallback` and `props.dataCallback` exists, then after
   *    evaluating `props.nodeCallback`, `props.dataCallback` will also be
   *    evaluated. Otherwise if `props.nodeCallback` is evaluated, no evaluation
   *    of `props.dataCallback` will happen.
   * @param {boolean} [props.doNotWither] If `true`, the tree will not advance
   *    its generation or trigger withering.
   * @param {boolean} [props.breakOnFalse=false] Whether the traversing should
   *    break if `false` has been returned from `callback`
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   * @returns {boolean} If the traverse breaks on `false`, returns `false`,
   *    otherwise `true`
   */
  _traverse (chrRange, props, ...args) {
    return this._root.traverse(chrRange, props, ...args)
  }

  /**
   * Get an array of chrRegions that do not have data ready.
   * This is used for sectional loading.
   *
   * @param {ChromRegion} chrRange the chromosomal range to query
   * @param {object} [props] additional properties being passed onto nodes
   * @param {Array<ChromRegion>} [props._result] Previous unloaded
   *    regions. This will be appended to the front of returned value.
   *    This array will be updated if it gets appended to reduce memory
   *    usage and GC.
   * @returns {Array<ChromRegion>} the chromosomal ranges
   *    that do not have their data ready in this data storage unit (therefore
   *    need to be fetched from sources). If all the data needed is ready, `[]`
   *    will be returned.
   */
  getUncachedRange (chrRange, props) {
    props = props || {}
    if (!this.localOnly &&
      (!chrRange || !chrRange.chr || chrRange.chr === this.chr)
    ) {
      chrRange = chrRange
        ? this._root.truncateChrRange(chrRange, true, false)
        : this.coveringRange
      return this._root.getUncachedRange(chrRange, props)
    } else {
      return []
    }
  }

  /**
   * Quickly check if the tree has any uncached range
   *    within a specific range.
   * This is used for sectional loading.
   *
   * @param {ChromRegion} chrRange the chromosomal range to query
   * @param {object} [props] additional properties being passed onto nodes
   * @returns {boolean} `true` if the tree has uncached ranges.
   */
  hasUncachedRange (chrRange, props) {
    props = props || {}
    if (!this.localOnly &&
      (!chrRange || !chrRange.chr || chrRange.chr === this.chr)
    ) {
      chrRange = chrRange
        ? this._root.truncateChrRange(chrRange, true, false)
        : this.coveringRange
      return this._root.hasUncachedRange(chrRange, props)
    }
    return false
  }
}

/**
 * Default non-leaf node constructor.
 * @type {function(new:GiveNonLeafNode)}
 * @memberof GiveTree
 */
GiveTree.DefaultNonLeafNodeCtor = GiveNonLeafNode
/**
 * Default leaf node constructor.
 * @type {function(new:GiveTreeNode)}
 * @memberof GiveTree
 */
GiveTree.DefaultLeafNodeCtor = GiveTreeNode

/**
 * Maximal generator number. Generations beyond this number will be wrapped to
 * 0 instead.
 * @type {number}
 * @memberof GiveTree
 */
GiveTree.MAX_GENERATION = Number.MAX_SAFE_INTEGER - 100
/**
 * Default length of branch lifespan.
 * @type {number}
 * @memberof GiveTree
 */
GiveTree.DEFAULT_LIFE_SPAN = 10

module.exports = GiveTree
