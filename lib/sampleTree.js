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
 * @module SampleTree
 */

const GiveTree = require('./giveTree')
const SampleNode = require('./sampleNode')
const DataNode = require('./dataNode')

/**
 * Oak tree for data storage, derived from B+ tree.
 * See `GIVE.GiveTree` for other properties and methods.
 * @property {number} branchingFactor - branching factor for the tree. The
 *    number of children for all non-root nodes will be equal to or greater
 *    than `this.branchingFactor / 2`. The number of children for all nodes
 *    will be smaller than `this.branchingFactor`. This is adapted from B+
 *    tree to achieve auto-balancing.
 * @property {GiveTreeNode} _NonLeafNodeCtor - Constructor for all non-leaf
 *    nodes. Should be `GIVE.OakNode` all the time. Can be overridden but not
 *    recommended.
 * @property {GiveTreeNode} _LeafNodeCtor - Constructor for all leaf nodes,
 *    `GIVE.DataNode` by default
 *
 * @class
 * @alias module:SampleTree
 *
 * @implements {GiveTree}
 *
 * @param {ChromRegion} chrRange - The range this data storage unit
 *    will be responsible for.
 * @param {Object} [props] - properties that will be passed to the individual
 *    implementations
 * @param {number} [props.branchingFactor] - for `this.branchingFactor`
 * @param {function} [props.NonLeafNodeCtor] - used to override non-leaf node
 *    constructors.
 * @param {function} [props.LeafNodeCtor] - if omitted, the constructor of
 *    `GiveTreeNS.DataNode` will be used
 */
class SampleTree extends GiveTree {
  constructor (chrRange, props) {
    // start and length is for the corresponding region
    // note that `SampleTree` should be populated with `OakNode`s
    super(chrRange, (props && props.NonLeafNodeCtor) || SampleNode, props)
  }

  _initProperties (chrRange, NonLeafNodeCtor, props) {
    props.LeafNodeCtor = props.LeafNodeCtor || DataNode
    super._initProperties(...arguments)
    if (
      !Number.isInteger(props.branchingFactor) || props.branchingFactor <= 2
    ) {
      console.info('Default branching factor chosen instead of ' +
        props.branchingFactor)
      this.branchingFactor = this.constructor._DEFAULT_B_FACTOR
    } else {
      this.branchingFactor = props.branchingFactor
    }
  }
}

SampleTree._DEFAULT_B_FACTOR = 50 // this value may need to be tweaked
SampleTree.neighboringLinks = true

module.exports = SampleTree
