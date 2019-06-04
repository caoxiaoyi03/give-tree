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
 * @module SampleNode
 * @exports SampleNode
 */

const GiveNonLeafNode = require('./giveNonLeafNode')
const GiveTreeNode = require('./giveTreeNode')

/**
 * Node interface for GIVE Trees
 *
 * @class
 * @alias module:SampleNode
 * @extends GiveNonLeafNode
 */
class SampleNode extends GiveNonLeafNode {
  /**
   * Extend the boundary of the tree and fill the spaces with `null` or `false`.
   * The first child (if `start` is being extended) and/or the last child (if
   * `end` is being extended) may be extended if they are the same as the
   * space filling.
   *
   * @param {boolean|null} [convertTo=null] The value to convert the empty space
   *    into. Should be `null` (default) or `false`.
   * @param {number} [start] - New `start` value
   * @param {number} [end] - New `end` value
   * @returns {SampleNode} `this`
   */
  _extendBoundary (convertTo, start, end) {
    let extendHappened = false
    if (typeof start === 'number' && start < this.start) {
      // extend start to new start
      if (this.reverseDepth > 0) {
        this.firstChild._extendBoundary(convertTo, start, null)
        this.start = start
      } else {
        if (this.firstChild === convertTo) {
          this.start = start
        } else {
          this.values.unshift(convertTo)
          this.keys.unshift(start)
        }
      }
      extendHappened = true
    }
    if (typeof end === 'number' && end > this.end) {
      // extend start to new start
      if (this.reverseDepth > 0) {
        this.lastChild._extendBoundary(convertTo, null, end)
        this.end = end
      } else {
        if (this.lastChild === convertTo) {
          this.end = end
        } else {
          this.values.push(convertTo)
          this.keys.push(end)
        }
      }
      extendHappened = true
    }
    if (!extendHappened) {
      throw new Error('No extension happened in _extendBounary! ' +
        'start: ' + start + '; end: ' + end)
    }
    return this._restructureImmediateChildren()
  }

  /**
   * Attempt to merge `this` with `node`. Return `true` if it is possible,
   * `false` if not. Nodes are mergeable if the result still comply with the
   * B+ tree requirements.
   *
   * @param {SampleNode} node The node being merged
   * @returns {boolean} Whether `this` is mergeable with `node` (and has
   *    already been merged) or not.
   */
  mergeAfter (node) {
    if (node instanceof this.constructor && this.end === node.start) {
      if (this.childNum === 1 && !this.values[0]) {
        // `this` is an empty node, assimilate everything from node, then
        // extend start
        node._extendBoundary(this.values[0], this.start)
        this.keys = node.keys
        this.values = node.values
      } else if (node.childNum === 1 && !node.values[0]) {
        this._extendBoundary(node.values[0], null, node.end)
      } else if (this.childNum + node.childNum <= this.tree.branchingFactor) {
        this.keys = this.keys.concat(node.keys.slice(1))
        this.values = this.values.concat(node.values)
      }
      return this
    }
    return false
  }

  /**
   * Split a child according to its type.
   *    If it is an `SampleNode`, split it to satisfy B+ tree requirements.
   *    If it is a `DataNode`, split as `GiveNonLeafNode._splitChild`
   *    does.
   *
   * @param  {number} index - index of the child to be split.
   * @param  {number} newKey - the new key separating the two children.
   *    Only used when the child is a `DataNode`.
   * @param  {GiveTreeNode|false|null} [newLatterChild] - the new
   *    latter child. If `undefined`, use the old child.
   *    Only used when the child is a `DataNode`.
   * @param  {GiveTreeNode|false|null} [newFormerChild] - the new
   *    former child. If `undefined`, use the old child.
   *    Only used when the child is a `DataNode`.
   * @returns {number} Number of split children
   */
  _splitChild (index, newKey, newLatterChild, newFormerChild) {
    if (this.reverseDepth <= 0) {
      return super._splitChild(...arguments)
    }
    if (this.values[index].length <= this.tree.branchingFactor) {
      return 1
    }
    // Node is over-capacity, split into sibling nodes
    // Calculate the number of siblings this node will split into
    let numOfSibs =
      Math.floor(this.values[index].childNum * 2 / this.tree.branchingFactor)
    // chop off children from the end
    for (let sibsLeft = numOfSibs - 1; sibsLeft > 0; sibsLeft--) {
      // get the number of children to be put into this sibling
      let sibNumOfChildren =
        Math.floor(this.values[index].childNum / (sibsLeft + 1))
      let props = {
        isRoot: false,
        // Extract one more key from this.keys
        keys: this.values[index].keys.slice(-(sibNumOfChildren + 1)),
        values: this.values[index].values.slice(-sibNumOfChildren),
        reverseDepth: this.values[index].reverseDepth,
        nextNode: this.values[index + 1],
        prevNode: this.values[index],
        tree: this.tree
      }
      this.values[index].keys.splice(-sibNumOfChildren)
      this.values[index].values.splice(-sibNumOfChildren)

      this.values.splice(index + 1, 0, new this.constructor(props))
      this.keys.splice(index + 1, 0, this.values[index].end)
    }
    return numOfSibs
  }

  _redistributeGrandChildren (index) {
    let sibNumOfChildren = Math.floor(
      (this.values[index - 1].childNum +
        this.values[index].childNum) / 2)
    if (sibNumOfChildren > this.tree.branchingFactor) {
      sibNumOfChildren = this.tree.branchingFactor
    }
    let deltaNum = sibNumOfChildren - this.values[index - 1].childNum
    if (deltaNum > 0) {
      // move from the latter sibling to the former
      this.values[index - 1].values = this.values[index - 1].values.concat(
        this.values[index].values.slice(0, deltaNum)
      )
      this.values[index - 1].keys = this.values[index - 1].keys.concat(
        this.values[index].keys.slice(1, deltaNum + 1)
      )
      this.values[index].values.splice(0, deltaNum)
      this.values[index].keys.splice(0, deltaNum)
    } else {
      // move from the latter sibling to the former
      // (notice that deltaNum < 0)
      this.values[index].values =
        this.values[index - 1].values.slice(deltaNum).concat(
          this.values[index].values
        )
      this.values[index].keys =
        this.values[index - 1].keys.slice(deltaNum - 1, -1).concat(
          this.values[index].keys
        )
      this.values[index - 1].values.splice(deltaNum)
      this.values[index - 1].keys.splice(deltaNum)
    }
    this.keys[index] = this.values[index].start
  }

  _restructureRoot () {
    // If this is root, then it needs to be responsible for itself
    if (this.isRoot) {
      let oldRoot = this
      let newRoot = this
      if (this.childNum > this.tree.branchingFactor) {
        // add a new layer of tree and return new root
        do {
          oldRoot = newRoot
          oldRoot.isRoot = false
          newRoot = new this.constructor({
            isRoot: true,
            // Put `this` and all siblings under the new root
            keys: [oldRoot.start, oldRoot.end],
            values: [oldRoot],
            reverseDepth: oldRoot.reverseDepth + 1,
            nextNode: null,
            prevNode: null,
            tree: oldRoot.tree
          })
          newRoot._splitChild(0)
        } while (newRoot.childNum > this.tree.branchingFactor)
      } else if (this.childNum <= 1 && this.reverseDepth > 0) {
        // reduce the number of layer of the tree to the first child
        // with `childNum > 1 || reverseDepth <= 0`
        oldRoot.isRoot = false
        do {
          oldRoot = newRoot
          newRoot = oldRoot.values[0]
          oldRoot.clear(null)
        } while (newRoot.childNum <= 1 && newRoot.reverseDepth > 0)
        newRoot.isRoot = true
      }
      return newRoot
    }
    return (!this.isEmpty) && this
  }

  /**
   * The function to be called after adding/removing data to the node.
   *
   * In SampleNodes, auto-balancing is implemented according to B+ tree
   * specs. `this._restructureImmediateChildren()` actually only rearranges
   * children to make sure they meet B+ tree requirements. `this` may not
   * meet B+ tree requirement if it's an intermediate node, which will be
   * handled by its immediate parent.
   *
   * If `this` is a root node and needs splitting / reducing length, a
   * new root node will be created to fix the tree structure and
   * returned.
   *
   * If there is no way to arrange children to make all children meet
   * B+ tree requirements, a `CannotBalanceError` will be thrown to allow
   * redistribution of children from parent nodes.
   * @param {boolean} intermediate - Whether this restructuring is an
   *    intermediate approach.
   *
   *    If this is `true`, then the function is called to rearrange in parent
   *    nodes because their children cannot get their grandchildren
   *    conforming to B+ tree requirements. If this is the case, the
   *    children in this call does not need to completely conform to B+
   *    tree requirements since the function flow will come back once the
   *    grandchildren have been rearranged.
   *
   * @returns {GiveNonLeafNode|false}
   *    Since auto-balancing is supported, the return value will be
   *    different for root and non-root nodes:
   *
   *    * For root nodes, this will return a new root if split/merge
   *      happens;
   *    * In all other cases, return `this` if it is not empty.
   * @throws {CannotBalanceError} Throw an error if after doing everything
   *    it can, it still cannot make all its children meet the B+ tree
   *    requirement. This would happen if a large number of nodes under
   *    this node were deleted and after merging all direct children, there
   *    is still not enough grandchildren for the child.
   */
  _restructureImmediateChildren (intermediate) {
    // Procedures:
    // 1. Iterate over all children to see if any of them need updating
    // 2. Redistribute / merge / split children depending on it and its
    //    siblings
    if (this.reverseDepth > 0) {
      for (let i = 0; i < this.childNum; i++) {
        let sibNext = (i < (this.childNum - 1)) ? i + 1 : i
        let sibPrev = (i < (this.childNum - 1)) ? i : i - 1
        if (this.values[i].childNum < this.tree.branchingFactor / 2) {
          if (this.childNum <= 1) {
            if ((!intermediate || this.values[i].childNum <= 1) &&
              !this.isRoot
            ) {
              // If this call is an intermediate adjustment, throw error
              //    only when `this` has one grandchild (therefore
              //    adjustment is not possible).
              // Otherwise throw when not all children can be rearranged
              //    to make them meet B+ tree requirements.
              throw new super.constructor.CannotBalanceError()
            }
          } else {
            // not enough grand-children for the child, redistribute / merge
            if (this.values[sibPrev].childNum +
              this.values[sibNext].childNum >
              this.tree.branchingFactor
            ) {
              // redistribution is enough
              this._redistributeGrandChildren(sibNext)
            } else {
              // needs merge
              this._mergeChild(sibNext)
              i--
            }
          }
        } else if (this.values[i].childNum > this.tree.branchingFactor) {
          // too many grand-children, redistribute / split
          if (this.childNum > 1 &&
            (this.values[sibPrev].childNum + this.values[sibNext].childNum <
              this.tree.branchingFactor * 2
            )
          ) {
            // redistribution is enough
            this._redistributeGrandChildren(sibNext)
          } else {
            // needs split
            i += this._splitChild(i) - 1
          }
        }
      }
    }
    if (!intermediate) {
      return this._restructureRoot()
    }
    return (!this.isEmpty) && this
  }

  _addNonLeafRecords (data, chrRange, props) {
    // This function only adds record(s), it won't restructure the tree

    // This is not a leaf node
    // Break out chrRange by child, then insert the sub-range into every
    //    child
    let currIndex = 0

    while (chrRange.start < chrRange.end) {
      while (this.keys[currIndex + 1] <= chrRange.start) {
        currIndex++
      }

      // Now the start of chrRange is in the range of current child
      let section = chrRange.clone()
      if (this.keys[currIndex + 1] < chrRange.end) {
        section.end = this.keys[currIndex + 1]
      }
      this.values[currIndex].insert(data, section, props)

      chrRange.start = section.end
      currIndex++
    } // end while(rangeStart < rangeEnd);
  }

  _addLeafRecords (data, chrRange, props) {
    // This function only adds record(s), it won't restructure the tree

    // Find the range of child that rangeStart is in
    let currIndex = 0
    props.dataIndex = 0
    let prevDataIndex
    props.continuedList = props.continuedList || []
    if (!(GiveTreeNode.prototype.isPrototypeOf(
      props.LeafNodeCtor.prototype
    ))) {
      throw new Error('LeafNodeCtor `' + props.LeafNodeCtor +
        '` is not a constructor for a tree node!')
    }

    while (this.keys[currIndex + 1] <= chrRange.start) {
      currIndex++
    }

    if (this.keys[currIndex] < chrRange.start) {
      // The new rangeStart appears between windows.
      // Shorten the previous data record by inserting the key,
      // and use this.values[currIndex] to fill the rest
      // (normally it should be `null`)
      this._splitChild(currIndex++, chrRange.start)
    }

    if (this.keys[currIndex + 1] > chrRange.end) {
      // The new rangeEnd appears between windows.
      // Shorten the next data record by inserting the key,
      // and use this.values[currIndex] to fill the current region
      // (normally it should be `null`)
      this._splitChild(currIndex, chrRange.end)
    }

    while (chrRange.start < chrRange.end) {
      while (this.keys[currIndex + 1] <= chrRange.start) {
        currIndex++
      }
      if (this.keys[currIndex] < chrRange.start) {
        // The new rangeStart appears between windows.
        // Shorten the previous data record by inserting the key,
        // and use `false` to fill the rest
        this._splitChild(currIndex++, chrRange.start, false)
      }

      if (
        props.continuedList.length > 0 ||
        (props.dataIndex < data.length &&
          data[props.dataIndex].start <= this.keys[currIndex])
      ) {
        // there are actual data at this location, create a new leaf node
        this.values[currIndex] = new props.LeafNodeCtor({
          start: this.keys[currIndex],
          end: this.keys[currIndex + 1]
        })
        this.values[currIndex].insert(data, chrRange, props)
        if (this.values[currIndex].isEmpty) {
          this.values[currIndex] = false
        }
      } else {
        // needs to fill the element with `false`, and merge with previous
        // if possible
        this.values[currIndex] = false
      }
      if (this._mergeChild(currIndex, false, true)) {
        currIndex--
      }

      // Shrink `chrRange` to unprocessed range
      chrRange.start = (
        props.dataIndex < data.length &&
        data[props.dataIndex].start < chrRange.end
      ) ? data[props.dataIndex].start : chrRange.end
    }

    this._mergeChild(currIndex, true, true)

    // Process `props.continuedList` for one last time
    props.continuedList = props.continuedList.concat(
      data.slice(prevDataIndex, props.dataIndex)
    ).filter(entry => entry.end > chrRange.end)

    // Remove all processed data from `data`
    data.splice(0, props.dataIndex)
    delete props.dataIndex
  }

  /**
   * Remove data entries from the node.
   *    Data entries with the same start (and end values if exists) will be
   *    removed. If multiple entries are found with the same start (and end
   *    values), the behavior will be defined by `exactMatch`.
   *    __NOTE:__ The tree will not be restructured due to the fact that
   *    multiple remove calls may happen within one action and restructuring
   *    every time incurs unnecessary computational burden.
   *
   * @param  {ChromRegion|GiveTreeNode} data - the data entry being
   *    removed.
   * @param  {boolean} exactMatch - whether an exact match is needed to
   *    remove multiple data entries with the same start and end values.
   *    If `true`, `data` will be compared by `.equalTo(data)` if exists,
   *    `===` if not. (this is done via calling
   *    `this.constructor._compareData(dataIn, dataEx)`)
   *    If `false`, all entries matching the start and end values will be
   *    removed.
   * @param {boolean|null} convertTo - what shall be used to replace
   *    the removed nodes, should be either `null` (default) or `false`.
   * @param  {Object|null} [props] - additional properties being
   *    passed onto nodes.
   * @param {function|null} props.callback - the callback function to be
   *    used (with the data entry as its sole parameter) when deleting
   * @returns {GiveTreeNode|boolean}
   *    If the node itself shall be removed, return a falsey value to allow
   *    parents to take additional steps.
   */
  remove (data, exactMatch, convertTo, props) {
    props = props || {}
    convertTo = (convertTo === false ? false : null)
    // Check whether `this` shall be removed
    if (this.start === data.start && this.end === data.end) {
      if (!exactMatch || this.constructor._compareData(data, this)) {
        // remove content of this
        if (typeof props.callback === 'function') {
          props.callback(this)
        }
        this.clear(convertTo)
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
      if (!this.values[i].remove(data, exactMatch, convertTo, props)) {
        // this node will be removed if it is not literally the first node
        //    of the tree
        if (this.reverseDepth <= 0) {
          this.values[i] = convertTo
          this._mergeChild(i, true, true)
          return this
        } else {
          // a branch need to be deleted, replace the region with `null`
          if (i < this.childNum - 1 &&
            (this.values[i + 1].firstLeaf === convertTo || i <= 0)
          ) {
            this._mergeChild(i + 1)
          } else if (i > 0) {
            this._mergeChild(i)
          } else {
            // only one child, remove `this` as well
            this.clear(convertTo)
            return !!this.isRoot
          }
        }
      }
    } else {
      console.warn('Data ' + data + ' is not found in the tree.')
    }
    return this
  }
}

/**
 * @static
 * @property {boolean} restructuringRequired - Whether restructuring is needed
 *    for this class of node
 * @memberof SampleNode
 */
SampleNode.restructuringRequired = true

module.exports = SampleNode
