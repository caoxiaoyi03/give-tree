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
 * @module GiveNonLeafNode
 * @exports GiveNonLeafNode
 *
 * @typedef {import('./giveTree')} GiveTree
 * @typedef {import('./dataNode')} DataNode
 */

const GiveTreeNode = require('./giveTreeNode')
const ChromRegion = require('@givengine/chrom-region')

/**
 * Specialized error used to signal cross-generation balancing requirements.
 *
 * @class
 * @extends {Error}
 */
class CannotBalanceError extends Error {
  constructor () {
    super(...arguments)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CannotBalanceError)
    }
  }
}

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
 * Non-leaf nodes for GIVE Trees
 * This is an interface for all nodes that belongs to GIVE Trees, including
 * insertion, deletion, traversing, and other functionalities.
 *
 * When traversing, everything in `continuedList` of __the starting record entry
 * (see {@link DataNode}) only__ will be processed first, then everything in
 * `startList` in all overlapping records will be processed.
 *
 * Note that when creating `GiveNonLeafNode` instances, `props` should either
 * have both `start` and `end`, or both `keys` and `values` specified in its
 * properties.
 *
 * @class
 * @abstract
 * @extends {GiveTreeNode}
 */
class GiveNonLeafNode extends GiveTreeNode {
  /**
   * Creates an instance of GiveNonLeafNode.
   * @constructor
   * @param {object} props Properties that will be passed to the
   *    individual implementations. For `GiveNonLeafNode`, these
   *    properties will be used:
   * @param {boolean} props.isRoot For {@link GiveNonLeafNode#isRoot}
   * @param {GiveTree} props.tree For `this.tree`
   * @param {number} [props.start] The start coordinate this node will
   *    cover. Equals to `this.keys[0]`.
   * @param {number} [props.end] The end coordinate this node will cover.
   *    Equals to `this.keys[this.keys.length - 1]`.
   *
   *    Exceptions will be thrown if `props.start` or `props.end` is not an
   *    positive integer number or `props.start >= props.end` (zero-length
   *    regions not allowed).
   * @param {number} [props.reverseDepth] For `this.reverseDepth`
   * @param {GiveNonLeafNode|boolean} [props.nextNode] For `this._next`
   * @param {GiveNonLeafNode|boolean} [props.prevNode] For `this._prev`
   * @param {Array<number>} [props.keys] For `this.keys`
   * @param {Array<GiveTreeNode>} [props.values] For `this.values`.
   *    Note that if `keys` and `values` are provided, `start` and `end`
   *    will be overridden as they are already provided in `keys`.
   */
  constructor (props) {
    super(...arguments)
    props = props || {}
    /**
     * Whether this node is a root node (needed to handle changes in tree
     * structure)
     * @type {boolean}
     * @memberof GiveNonLeafNode#
     */
    this.isRoot = !!props.isRoot
    /**
     * Links to the {@link GiveTree} object to access tree-wise properties.
     * @type {GiveTree}
     * @memberof GiveNonLeafNode#
     */
    this.tree = props.tree
    if (
      Array.isArray(props.keys) && Array.isArray(props.values) &&
      props.values.length === props.keys.length - 1
    ) {
      // TODO: Sanity check for `this.keys`?
      /**
       * A list of keys of children. See {@link GiveNonLeafNode#values}.
       * @type {Array<number>}
       * @memberof GiveTreeNode#
       */
      this.keys = props.keys
      /**
       * A list of data entries, can be `null` or `false` to represent data not
       * loaded and empty nodes respectively.
       *
       * *   `keys.length` will be `1` more than `childNum`;
       * *   `keys[i]` will be the start coordinate of `values[i]` and end
       *     coordinate of `values[i - 1]`;
       * *   `keys[keys.length - 1]` will be the end coordinate of
       *     `values[childNum - 1]`.
       *
       * Therefore, neighboring nodes will have exactly one overlapping key.
       *
       * `values` can be `false` or `null` (unless prohibited by implementation)
       * indicating empty regions or data not loaded, respectively.
       * @type {Array<GiveTreeNode|null|boolean>}
       */
      this.values = props.values
    } else {
      if (!Number.isInteger(props.start) || !Number.isInteger(props.end)) {
        throw (new Error('start or end is not an integer number ' +
          'in non-leaf node construction!'))
      } else if (props.start < 0 || props.end < 0 ||
        props.start >= props.end
      ) {
        throw (new Error('Range error. start: ' + props.start +
          ', end: ' + props.end))
      }
      this.keys = [props.start, props.end]
      this.values = [this.emptyChildValue]
    }
    /**
     * "Reversed depth" of the node. The one holding leaf nodes (should be
     * {@link DataNode} or similar implementations) is at `0` and root is at
     * the maximum.
     * @type {number}
     * @memberof GiveNonLeafNode#
     */
    this.reverseDepth = (
      Number.isInteger(props.reverseDepth) && props.reverseDepth > 0)
      ? props.reverseDepth : 0
    if (this.tree.neighboringLinks) {
      this.next = props.nextNode
      this.prev = props.prevNode
    }
  }

  /**
   * The value for an empty child node
   * @type {null|boolean}
   *
   * @readonly
   * @memberof GiveNonLeafNode#
   */
  get emptyChildValue () {
    return this.tree.localOnly ? false : null
  }

  get coveringRange () {
    return new ChromRegion({
      chr: this.tree.chr,
      start: this.start,
      end: this.end
    })
  }

  getChildCoveringRange (index) {
    let result
    if (index >= 0 && index <= this.childNum) {
      if (this.values[index]) {
        result = this.values[index].coveringRange
      }
      return result || new ChromRegion({
        chr: this.tree.chr,
        start: this.keys[index],
        end: this.keys[index + 1]
      })
    }
    return null
  }

  /**
   * Trancate chromosomal range to the region covered by
   *  `this`.
   *
   * @param  {ChromRegion} chrRange The chromosomal range to be
   *    truncated
   * @param  {boolean} [truncStart] Whether to truncate the start coordinate
   * @param  {boolean} [truncEnd]   Whether to truncate the end coordinate
   * @param  {boolean} [doNotThrow] Whether to throw an exception if
   *    truncated region has a length not greater than 0 (because `chrRange`
   *    does not overlap with this node at all).
   * @returns {ChromRegion}  Returns a new chromosomal range with
   *    trancated coordinates.
   */
  truncateChrRange (chrRange, truncStart, truncEnd, doNotThrow) {
    var newRegion = chrRange.clone()
    try {
      if (truncStart && newRegion.start < this.start) {
        newRegion.start = this.start
      }
      if (truncEnd && newRegion.end > this.end) {
        newRegion.end = this.end
      }
    } catch (err) {
      if (!doNotThrow) {
        throw (new Error(chrRange + ' is not a valid chrRegion ' +
          'or not overlapping with the current node. \nRange start: ' +
          newRegion.start + ', end: ' + newRegion.end +
          '\nCurrent node start: ' + this.start +
          ', end: ' + this.end))
      }
    }
    return newRegion
  }

  get start () {
    return this.keys[0]
  }

  get end () {
    return this.keys[this.keys.length - 1]
  }

  /**
   * The length of the region covered by this node
   *
   * @type {number}
   */
  get length () {
    return this.end - this.start
  }

  /**
   * The number of children under this node.
   *
   * @type {number}
   */
  get childNum () {
    return this.values.length
  }

  set start (newStart) {
    this.keys[0] = newStart
  }

  set end (newEnd) {
    this.keys[this.keys.length - 1] = newEnd
  }

  /**
   * The next node
   *
   * @type {GiveNonLeafNode|null}
   */
  get next () {
    if (!this.tree.neighboringLinks) {
      throw new Error(
        'Cannot get the next sibling in an unlinked tree!')
    }
    /**
     * The next node (sibling). Can be `null` or `false`.
     * @type {GiveNonLeafNode|null|boolean}
     * @memberof GiveNonLeafNode#
     */
    return this._next
  }

  /**
   * The previous node
   *
   * @type {GiveNonLeafNode|null}
   */
  get prev () {
    if (!this.tree.neighboringLinks) {
      throw new Error(
        'Cannot get the previous sibling in an unlinked tree!')
    }
    /**
     * The previous node (sibling). Can be `null` or `false`.
     * @type {GiveNonLeafNode|null|boolean}
     * @memberof GiveNonLeafNode#
     */
    return this._prev
  }

  set next (nextNode) {
    if (!this.tree.neighboringLinks) {
      throw new Error(
        'Cannot set the next sibling in an unlinked tree!')
    }
    if (nextNode === undefined) {
      nextNode = null
    }
    this._next = nextNode
    if (nextNode) {
      nextNode._prev = this
      if (this.lastChild instanceof GiveNonLeafNode) {
        this.lastChild.next = nextNode.firstChild
      } else {
        // needs to handle child connections by themselves
        if (nextNode.firstChild instanceof GiveNonLeafNode) {
          nextNode.firstChild.prev = this.lastChild
        }
      }
    } else {
      // `nextNode === null` or `nextNode === false`
      try {
        this.lastChild.next = nextNode
      } catch (ignore) { }
    }
  }

  set prev (prevNode) {
    if (!this.tree.neighboringLinks) {
      throw new Error(
        'Cannot set the previous sibling in an unlinked tree!')
    }
    if (prevNode === undefined) {
      prevNode = null
    }
    this._prev = prevNode
    if (prevNode) {
      prevNode._next = this
      if (this.firstChild instanceof GiveNonLeafNode) {
        this.firstChild.prev = prevNode.lastChild
      } else {
        // needs to handle child connections by themselves
        if (prevNode.lastChild instanceof GiveNonLeafNode) {
          prevNode.lastChild.next = this.firstChild
        }
      }
    } else {
      // `nextNode === null` or `nextNode === false`
      try {
        this.firstChild.prev = prevNode
      } catch (ignore) { }
    }
  }

  /**
   * Break links between siblings and `this`
   *
   * @param  {boolean|null} [convertTo=null] convert the link into. Should be
   *    `null` (default) or `false`.
   * @param  {boolean} [noPrev] Do not severe links from previous siblings
   * @param  {boolean} [noNext] Do not severe links from next siblings
   */
  _severeSelfLinks (convertTo, noPrev, noNext) {
    if (!this.tree.neighboringLinks) {
      throw new Error(
        'No sibling links to severe in an unlinked tree!')
    }
    if (!noPrev) {
      try {
        this.prev.next = convertTo
      } catch (ignore) { }
    }
    if (!noNext) {
      try {
        this.next.prev = convertTo
      } catch (ignore) { }
    }
  }

  /**
   * Break links between all children.
   *
   * @param  {boolean|null} [convertTo=null] convert the link into. Should be
   *    either `null` (default) or `false`.
   * @param  {boolean} [noPrev] Do not severe links from previous siblings
   * @param  {boolean} [noNext] Do not severe links from next siblings
   */
  _severeChildLinks (convertTo, noPrev, noNext) {
    if (!this.tree.neighboringLinks) {
      throw new Error(
        'No child links to severe in an unlinked tree!')
    }
    if (!noPrev) {
      try {
        this.firstChild._severeLinks(convertTo, false, true)
      } catch (ignore) { }
    }
    if (!noNext) {
      try {
        this.lastChild._severeLinks(convertTo, true, false)
      } catch (ignore) { }
    }
  }

  /**
   * Break links between siblings and `this`, and between all
   *    children as well.
   *
   * @param  {boolean|null} [convertTo=null] convert the link into. Should be
   *    either `null` (default) or `false`.
   * @param  {boolean} [noPrev] Do not severe links from previous siblings
   * @param  {boolean} [noNext] Do not severe links from next siblings
   */
  _severeLinks (convertTo, noPrev, noNext) {
    this._severeChildLinks(convertTo, noPrev, noNext)
    this._severeSelfLinks(convertTo, noPrev, noNext)
  }

  /**
   * Fix sibling links for a specific child.
   *
   * @param  {number} index The index of the child
   * @param  {boolean} [doNotFixBack] If `true`, the links after this child
   *    will not be fixed.
   * @param  {boolean} [doNotFixFront] If `true`, the links before this
   *    child will not be fixed.
   */
  _fixChildLinks (index, doNotFixBack, doNotFixFront) {
    if (!this.tree.neighboringLinks) {
      throw new Error('No child links to fix in an unlinked tree!')
    }
    if (this.reverseDepth > 0) {
      if (!doNotFixBack) {
        try {
          let nextChild = this._getChildNext(index)
          if (this.values[index]) {
            this.values[index].next = nextChild
          } else {
            nextChild.prev = this.values[index]
          }
        } catch (ignore) { }
      }
      if (!doNotFixFront) {
        try {
          let prevChild = this._getChildPrev(index)
          if (this.values[index]) {
            this.values[index].prev = prevChild
          } else {
            prevChild.next = this.values[index]
          }
        } catch (ignore) { }
      }
    }
  }

  /**
   * The first child element of `this`.
   *
   * @type {GiveTreeNode|boolean|null}  The first child element
   */
  get firstChild () {
    return this.values[0]
  }

  /**
   * The first leaf element of `this`.
   *
   * @type {GiveTreeNode|boolean|null}  The first child element
   */
  get firstLeaf () {
    return this.reverseDepth > 0 ? this.firstChild.firstLeaf : this.firstChild
  }

  /**
   * The last child element of `this`.
   *
   * @type {GiveTreeNode|boolean|null}  The last child element
   */
  get lastChild () {
    return this.values[this.childNum - 1]
  }

  get lastLeaf () {
    return this.reverseDepth > 0 ? this.lastChild.lastLeaf : this.lastChild
  }

  /**
   * Get the previous sibling of child at `index`.
   *
   * @param {number} index Index of the child
   * @returns {GiveTreeNode|boolean|null}  the previous sibling of the
   *    child
   * @throws {Error} If no children available, throw an error
   */
  _getChildPrev (index) {
    if (index > 0) {
      return this.values[index - 1]
    }
    if (this.prev) {
      return this.prev.lastChild
    }
    throw new Error('No previous children!')
  }

  /**
   * Get the next sibling of child at `index`.
   *
   * @param {number} index Index of the child
   * @returns {GiveTreeNode|boolean|null}  the next sibling of the
   *    child
   * @throws {Error} If no children available, throw an error
   */
  _getChildNext (index) {
    if (index < (this.childNum - 1)) {
      return this.values[index + 1]
    }
    if (this.next) {
      return this.next.firstChild
    }
    throw new Error('No next children!')
  }

  /**
   * Insert data under this node.
   *
   * If auto-balancing is supported, after `this.insert()` is called, the
   * immediate children should all be balanced (`this` may still have
   * non-compliant number of children). If all children insertions
   * were done with `child.insert()` then the entire tree should be balanced.
   * If not, then child balancing needs to be done in
   * `this._addNonLeafRecords`.
   *
   * @param {Array<ChromRegion>} data The sorted array of data
   *    entries (each should be an extension of `ChromRegion`).
   *
   *    `data === null` or `data === []` means there is no data in `chrRange`
   *    and `false`s will be used in actual storage.
   *
   *    __NOTICE:__ any data starting before `chrRange.start` and overlapping
   *    `chrRange` should appear in `props.continuedList` only (this will be
   *    automatically handled in `GiveTree.insert`). Only data starting
   *    __at or after__ `chrRange.start` shall be included in `data`.
   *
   *    After insertion, any entry within `data` that overlaps `chrRange`
   *    will be deleted from the array. (Ranges extending over `chrRange.end`
   *    will be put into `props.continuedList`)
   * @param {ChromRegion} chrRange The chromosomal range that
   *    `data` corresponds to.
   *
   *    This is used to mark the empty regions correctly. No `null` will
   *    present within these regions after this operation.
   *
   *    This parameter should be an `Object` with at least two properties:
   *    `{ start: <start coordinate>, end: <end coordinate>, ... }`,
   *    preferably a `ChromRegion` object.
   * @param {object} [props] Additional properties being passed onto
   *    nodes.
   * @param {Array<ChromRegion>} [props.continuedList] The list of data
   *    entries that should not start in `chrRange` but are passed from the
   *    earlier regions, this will be useful for later regions if date for
   *    multiple regions are inserted at the same time
   * @param {DataEntryCallback} [props.dataCallback] The callback function to be
   *    used when inserting.
   * @param {function(new:GiveTreeNode)} [props.LeafNodeCtor] The constructor
   *    function of leaf nodes if they are not the same as the non-leaf nodes.
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   * @returns {GiveNonLeafNode|false}
   *    This shall reflect whether auto-balancing is supported for the tree.
   *    See `_restructureImmediateChildren` for
   *    details.
   */
  insert (data, chrRange, props, ...args) {
    // clip chrRegion first (should never happen)
    chrRange = this.truncateChrRange(chrRange, true, true)
    // Procedures:
    // 1. Do the actual insertion.
    //    There are two cases for insertion:
    //    a. leaf nodes: use `DataNode` to store raw data
    //    b. non-leaf nodes:
    //       go deep to generate branch structure, or update summary
    //       (for trees that support summary and resolutions)
    //    Update post-insertion affected ranges in `prop._postInsertionOpRange`
    // 2. Do post-insertion operations on `prop._postInsertionOpRange`.
    //    The node shall implement `this._postInsertion`.
    if (this.reverseDepth > 0) {
      // case 2
      this._addNonLeafRecords(data, chrRange, props, ...args)
      // Note: keys may change after adding leaf records
      this.keys = this.values.map(node => node.start)
      this.keys.push(this.lastChild.end)
    } else {
      // case 1
      this._addLeafRecords(data, chrRange, props, ...args)
    }

    // At this point insertion has been done, but the nodes after the insertion
    // range may need to be updated due to the `continuedList` and (possibly)
    // merging of `startList`
    if (props._postInsertionOpRange &&
      typeof props.LeafNodeCtor.postInsertOp === 'function'
    ) {
      props._postInsertionOpRange =
        props._postInsertionOpRange.getMinus(chrRange).pop()
      this.traverse(props._postInsertionOpRange, {
        nodeCallback: props.LeafNodeCtor.postInsertOp,
        nodeFilter: node => node instanceof props.LeafNodeCtor,
        allowNull: true
      }, props.continuedList.slice())
    }
    return this.constructor.restructuringRequired
      ? this._restructureImmediateChildren()
      : (this.isRoot || !this.isEmpty) && this
  }

  /**
   * The function to be called after adding/removing data to the node.
   *
   * This is used in implementations that involve post-insertion
   *    processes of the tree (for example, rebalancing in B+ tree
   *    derivatives).
   *
   * The function will only restructure the immediate children of `this`
   *    or `this` if it is a root node. It will assume all grandchildren
   *    (if any) has been already restructured correctly.
   *
   * For trees that do not implement post-insertion processes, return
   *    `this`.
   *
   * @param {boolean} intermediate Whether this restructuring is an
   *    intermediate approach.
   *
   *    If this is `true`, then the function is called to rearrange in parent
   *    nodes because their children cannot get their grandchildren
   *    conforming to B+ tree requirements. If this is the case, the
   *    children in this call does not need to completely conform to B+
   *    tree requirements since the function flow will come back once the
   *    grandchildren have been rearranged.

   * @returns {GiveNonLeafNode|false}
   *    This shall reflect whether there are any changes in the tree
   *    structure for root and non-root nodes:
   *    * For root nodes, always return `this` (cannot delete root even
   *      without any children).
   *    * For inner nodes (or leaf), if the node should be removed (being
   *      merged with its sibling(s) or becoming an empty node, for
   *      example), return `false`. Return `this` in all other cases.
   */
  _restructureImmediateChildren (intermediate) {
    // for non-auto-balancing trees, return false if this node has no data
    //    any more
    if (this.values[0] && this.values[0].isEmpty) {
      this.values[0] = false
    }
    return (this.isRoot || !this.isEmpty) && this
  }

  /**
   * The function to be called after adding/removing data to the node.
   *
   * This is used in implementations that involve post-insertion
   *    processes of the tree (for example, rebalancing in B+ tree
   *    derivatives).
   *
   * The function will only restructure the immediate children of `this`
   *    or `this` if it is a root node. It will assume all grandchildren
   *    (if any) has been already restructured correctly.
   *
   * For trees that do not implement post-insertion processes, return
   *    `this`.
   *
   * @returns {GiveNonLeafNode|false}
   *    This shall reflect whether there are any changes in the tree
   *    structure for root and non-root nodes:
   *    * For root nodes, always return `this` (cannot delete root even
   *      without any children).
   *    * For inner nodes (or leaf), if the node should be removed (being
   *      merged with its sibling(s) or becoming an empty node, for
   *      example), return `false`. Return `this` in all other cases.
   */
  restructure () {
    // for non-auto-balancing trees, return false if this node has no data
    //    any more
    if (this.constructor.restructuringRequired) {
      try {
        if (this.reverseDepth > 0) {
          let grandChildrenCompliant = false
          do {
            try {
              this.values.forEach(node => node._restructure())
              grandChildrenCompliant = true
            } catch (err) {
              if (err instanceof CannotBalanceError) {
                this._restructureImmediateChildren(true)
              }
            }
          } while (!grandChildrenCompliant)
        }
      } catch (err) {
        if (err instanceof CannotBalanceError && !this.isRoot) {
          throw err
        }
      }
      return this._restructureImmediateChildren()
    }
    return (this.isRoot || !this.isEmpty) && this
  }

  /**
   * Add records to a non-leaf node.
   *
   * @abstract
   * @param {Array<ChromRegion>} data The sorted array of data
   *    entries. See `this.insert` for detailed description.
   * @param {ChromRegion} chrRange See `this.insert`
   * @param {object} props Additional properties being passed onto nodes.
   * @param {Array<ChromRegion>} props.continuedList See `this.insert`
   * @param {DataEntryCallback} [props.dataCallback] See `this.insert`
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   */
  _addNonLeafRecords (data, chrRange, props, ...args) {
    throw new Error('GiveNonLeafNode._addNonLeafRecords not ' +
      'implemented in `' + this.constructor.name + '`!')
  }

  /**
   * Add records to a leaf node (with `revDepth === 0`).
   *
   * @abstract
   * @param {Array<ChromRegion>} data The sorted array of data
   *    entries. See `this.insert` for detailed description.
   * @param {ChromRegion} chrRange See `this.insert`
   * @param {object} props Additional properties being passed onto nodes.
   * @param {Array<ChromRegion>} props.continuedList See `this.insert`
   * @param {DataEntryCallback} props.dataCallback See `this.insert`
   * @param {function(new:GiveTreeNode)} [props.LeafNodeCtor] See `this.insert`
   * @param {...object} [args] Additional arguments that may be passed to all
   *    callbacks.
   */
  _addLeafRecords (data, chrRange, props, ...args) {
    throw new Error('GiveNonLeafNode._addLeafRecords not ' +
      'implemented in `' + this.constructor.name + '`!')
  }

  /**
   * Clear the node into a given empty value, or `this.emptyChildValue`
   *
   * @param {boolean|null} [convertTo] converted value
   * @memberof GiveNonLeafNode#
   */
  clear (convertTo) {
    convertTo = convertTo === false ? false : this.emptyChildValue
    if (this.tree.neighboringLinks) {
      this._severeChildLinks(convertTo)
    }
    this.keys = [this.start, this.end]
    this.values = [convertTo]
    return this.restructure()
  }

  /**
   * Split a child into two.
   *
   * If the old child at `index` is not `null` or `false`, both
   *    `newLatterChild` and `newFormerChild` will be needed (otherwise the
   *    tree structure may be corrupted).
   *
   * @param  {number} index Index of the child to be split.
   * @param  {number} newKey The new key separating the two children
   * @param  {GiveTreeNode|false|null} [newLatterChild] The new
   *    latter child. If `undefined`, use the old child.
   * @param  {GiveTreeNode|false|null} [newFormerChild] The new
   *    former child. If `undefined`, use the old child.
   * @returns {number} Number of split children (2 in this case)
   */
  _splitChild (index, newKey, newLatterChild, newFormerChild) {
    if (this.values[index] &&
      (newLatterChild === undefined && newFormerChild === undefined)
    ) {
      if (this.tree.localOnly) {
        newLatterChild = this.emptyChildValue
      } else {
        throw new Error('Cannot split an existing child without ' +
          'providing both resulting siblings!')
      }
    }
    this.keys.splice(index + 1, 0, newKey)
    this.values.splice(index + 1, 0,
      newLatterChild === undefined ? this.values[index] : newLatterChild)
    if (newLatterChild !== undefined) {
      if (this.tree.neighboringLinks) {
        this._fixChildLinks(index + 1, false, true)
      }
    }
    if (newFormerChild !== undefined) {
      this.Value[index] = newFormerChild
      if (this.tree.neighboringLinks) {
        this._fixChildLinks(index, newLatterChild === undefined, false)
      }
    }
    return 2
  }

  /**
   * Determine whether two children are mergable.
   *
   * @static
   * @param  {type} childFront The child at front being considered to
   *    merge.
   * @param  {type} childBack The child at back being considered to merge.
   * @returns {type}            Return whether the children are mergable.
   *
   *    If both are `null` or both are `false`, return `true`.
   *    If `childFront` has `.mergeAfter(child)` function and returns true
   *      when called with `childBack`, return `true`.
   *
   *    Return false on all other cases.
   */
  static _childMergable (childFront, childBack) {
    return (childFront === childBack &&
      (childFront === this.emptyChildValue || childFront === false)
    ) || (childFront && childFront.mergeAfter(childBack)
    )
  }

  /**
   * Merge neighboring children that are the same as
   *    `this.values[index]`, if they are `false` or `null`.
   *    This function will always merge with the child __before__ `index`
   *    first, then, if `mergeNext === true`, merge with the child after
   *    `index`.
   *
   * @param  {number} index Index of the child
   * @param  {boolean} mergeNext Whether merge the next child as well
   * @param  {boolean} crossBorder Whether merging can happen across
   *    parent borders. If so, the children nodes in siblings of this may be
   *    expanded. (The number of children will not be affected in sibling
   *    nodes, so that the structure of neighboring nodes are not messed
   *    up.)
   *
   *    __Note:__ `crossBorder` can only be used when
   *    `this.tree.neighboringLinks === true`.
   *    If `this.tree.neighboringLinks === false`, this argument will be
   *    ignored, because `this` has no way of knowing its own siblings, thus
   *    unable to merge children across sibling
   *    borders.
   * @returns {boolean} whether merge happened to the previous child (this
   *    is used for calling function to correct indices when merging during
   *    traversing.)
   */
  _mergeChild (index, mergeNext, crossBorder) {
    let mergedFront = false
    if (index > 0 ||
      (this.tree.neighboringLinks && crossBorder && this.childNum > 1)
    ) {
      // merge previous child first
      try {
        if (this.constructor._childMergable(
          this._getChildPrev(index), this.values[index]
        )) {
          // remove child at `index`
          this.keys.splice(index, 1)
          this.values.splice(index, 1)
          if (this.tree.neighboringLinks) {
            if (index === 0) {
              this.prev.end = this.start
              this._fixChildLinks(index, true)
            } else {
              this._fixChildLinks(index - 1, false, true)
            }
          }
          mergedFront = true
        }
      } catch (ignore) {}
    }

    // if `mergeNext` is `true`, do the same to the next node
    if (mergeNext) {
      if (index < this.childNum - 1 &&
        this.constructor._childMergable(
          this.values[index], this.values[index + 1]
        )
      ) {
        // remove child at `index + 1`
        this.keys.splice(index + 1, 1)
        this.values.splice(index + 1, 1)
        if (this.tree.neighboringLinks) {
          this._fixChildLinks(index, false, true)
        }
      } else if (
        crossBorder && index === this.childNum - 1 &&
        this.next && this.childNum > 1 &&
        this.constructor._childMergable(
          this.values[index], this._getChildNext(index)
        )
      ) {
        this.next.keys[0] = this.keys[index]
        this.next.values[0] = this.values[index]
        this.keys.splice(-1)
        this.values.splice(-1)
        // needs to change the boundary of sibling node
        this.end = this.next.start
        if (this.tree.neighboringLinks) {
          this.next._fixChildLinks(0, false, true)
        }
      }
    }
    return mergedFront
  }

  _traverseChildren (chrRange, props, ...args) {
    // Implementation without resolution support
    // Because this is a non-leaf node, it always descends to its children
    // until some leaf node is reached.
    let index = 0
    while (this.keys[index] < chrRange.end && index < this.childNum) {
      while (index < this.childNum &&
        this.keys[index + 1] <= chrRange.start
      ) {
        index++
      }
      if (!props.allowNull && this.values[index] === null) {
        throw new Error('Data not ready for region ' +
          this.getChildCoveringRange(index).toString())
      }
      if (this.values[index] &&
        !this.values[index].traverse(chrRange, props, ...args)
      ) {
        return false
      }
      props.notFirstCall = (this.values[index] !== null)
      index++
    }
    return true
  }

  removeData (data, props, ...args) {
    // Check whether `this` shall be removed
    // if data is a ChrRange, then
    if (this.start === data.start && this.end === data.end) {
      if (!props.exactMatch || this.constructor._compareData(data, this)) {
        // remove content of this
        if (typeof props.dataCallback === 'function') {
          props.dataCallback(this, null, props, ...args)
        }
        this.clear(props.convertTo)
        return !!this.isRoot
      }
    }

    // data being remove is not self
    // locate the child entry first
    let i = 0
    while (i < this.childNum && this.keys[i + 1] <= data.start) {
      i++
    }
    if (this.values[i]) {
      // data must fall within `this.values[i]`
      if (!this.values[i].remove(data, props, ...args)) {
        this.values[i] = props.convertTo
      }
      // this node will be removed if it is not literally the first node
      //    of the tree
      if (this.reverseDepth <= 0) {
        this._mergeChild(i, true, true)
        return this
      } else {
        // a branch need to be deleted, replace the region with `null`
        if (i < this.childNum - 1 &&
            (this.values[i + 1].firstLeaf === props.convertTo || i <= 0)
        ) {
          this._mergeChild(i + 1)
        } else if (i > 0) {
          this._mergeChild(i)
        } else if (this.values[i].isEmpty) {
          // only one child, remove `this` as well
          this.clear(props.convertTo)
          return !!this.isRoot
        }
      }
    } else {
      console.warn('Data ' + data + ' is not found in the tree.')
    }
    return this
  }

  /**
   * Return an array of chrRegions that does not have
   *   data loaded to allow buffered loading of data
   *
   * @param  {ChromRegion} chrRange The range of query.
   * @param  {object} props Additional properties being passed onto nodes
   * @param  {Array<ChromRegion>} [props._result] Previous unloaded
   *    regions. This will be appended to the front of returned value.
   *    This array will be updated if it gets appended to reduce memory
   *    usage and GC.
   * @returns {Array<ChromRegion>} An ordered array of non-overlapping regions
   *    that does not have the data at the current resolution requirement.
   *    If no non-data ranges are found, return []
   */
  getUncachedRange (chrRange, props) {
    props._result = props._result || []
    let index = 0
    while (index < this.childNum && this.keys[index + 1] <= chrRange.start) {
      index++
    }
    while (index < this.childNum &&
        this.keys[index] < chrRange.end
    ) {
      if (this.values[index]) {
        // there is a child node here, descend
        this.values[index].getUncachedRange(chrRange, props)
      } else if (this.values[index] === null) {
        let newStart = Math.max(this.keys[index], chrRange.start)
        let newEnd = Math.min(this.keys[index + 1], chrRange.end)
        let newRegion = new ChromRegion({
          chr: chrRange.chr,
          start: newStart,
          end: newEnd
        })
        if (!props._result.some((resRegion, index, resArray) => {
          if (resRegion.assimilate(newRegion) || resRegion.concat(newRegion)) {
            // newRegion has been assimilated by `resRegion`
            for (let i = index + 1; i < resArray.length; i++) {
              if (resRegion.assimilate(resArray[i])) {
                resArray.splice(i--, 1)
              }
            }
            return true
          }
          return false
        })) {
          props._result.push(newRegion)
          props._result.sort(ChromRegion.compare)
        }
      }
      index++
    }
    return props._result
  }

  hasUncachedRange (chrRange, props) {
    var index = 0
    while (index < this.childNum && this.keys[index + 1] <= chrRange.start) {
      index++
    }
    while (index < this.childNum && this.keys[index] < chrRange.end) {
      if (this.values[index]) {
        // there is a child node here, descend
        if (this.values[index].hasUncachedRange(chrRange, props)) {
          return true
        }
      } else if (this.values[index] === null) {
        return true
      }
      index++
    }
    return false
  }

  /**
   * Whether this node is empty.
   * If there is no child then the node is considered empty.
   *
   * @type {boolean}
   */
  get isEmpty () {
    return this.childNum <= 0 || (this.childNum === 1 &&
      (this.values[0] === false ||
        !!(this.values[0] && this.values[0].isEmpty)))
  }
}

/**
 * @static
 * @property {boolean} restructuringRequired Whether restructuring is needed
 *    for this class of node
 * @memberof GiveNonLeafNode
 */
GiveNonLeafNode.restructuringRequired = false

/**
 * @static
 * @property {typeof CannotBalanceError} CannotBalanceError Specialized error
 * used to signal cross-generation balancing requirements.
 * @memberof GiveNonLeafNode
 */
GiveNonLeafNode.CannotBalanceError = CannotBalanceError

module.exports = GiveNonLeafNode
