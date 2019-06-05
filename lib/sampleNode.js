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
