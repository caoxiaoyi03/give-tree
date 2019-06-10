const GiveTree = require('../lib/giveTree')
const GiveTreeNode = require('../lib/giveTreeNode')
const GiveNonLeafNode = require('../lib/giveNonLeafNode')
const DataNode = require('../lib/dataNode')
const SampleTree = require('../lib/sampleTree')

const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
const expect = chai.expect

const ChromRegion = require('@givengine/chrom-region')

describe('Give tree tests', function () {
  before('Initialize data array.', function () {
    this.dataArray = [
      new ChromRegion('chr1:3-9', null, {
        flag1: 'dataFlag 1-0'
      }),
      new ChromRegion('chr1:5-150(-)', null, {
        flag1: 'dataFlag 2-0'
      }),
      new ChromRegion('chr1:5-100(+)', null, {
        flag1: 'dataFlag 2-1'
      }),
      new ChromRegion('chr1:10-11(+)', null, {
        flag1: 'dataFlag 3-0'
      }),
      new ChromRegion('chr1:12-1200(-)', null, {
        flag1: 'dataFlag 4-0'
      }),
      new ChromRegion('chr1:12-1200(+)', null, {
        flag1: 'dataFlag 4-1'
      }),
      new ChromRegion('chr1:51-100', null, {
        flag1: 'dataFlag 5-0'
      }),
      new ChromRegion('chr1:123-456(-)', null, {
        flag1: 'dataFlag 6-0'
      }),
      new ChromRegion('chr1:123-789(+)', null, {
        flag1: 'dataFlag 6-1',
        flag2: 'dataFlag2 6-1'
      }),
      new ChromRegion('chr1:234-789', null, {
        flag1: 'dataFlag 7-0',
        flag2: 'dataFlag2 7-0'
      })
    ]
    this.treeRange = new ChromRegion('chr1:1-2000')
    this.nonOverlappingRange = new ChromRegion('chr1:2002-4000')
    this.diffChrRange = new ChromRegion('chr2:1-1000')
  })

  it('Expect tree nodes are of the correct type.', function () {
    expect(() => new SampleTree(this.treeRange, {
      NonLeafNodeCtor: String,
      LeafNodeCtor: Number
    })).to.throw()
    expect(() => new SampleTree(this.treeRange, {
      NonLeafNodeCtor: GiveTreeNode
    })).to.throw()
  })

  describe('New sample non-local tree.', function () {
    it('Insert.', function () {
      let tree = new SampleTree(this.treeRange)
      let dataArray = this.dataArray.slice()
      let insertCallbackContainer = []

      expect(tree).to.be.instanceOf(GiveTree)
      expect(() =>
        tree._root.truncateChrRange(this.nonOverlappingRange, true, true, false)
      ).to.throw()
      expect(tree._root.isEmpty).to.be.false()
      expect(tree._root.getUncachedRange(new ChromRegion('chr1:300-1000'), {
        _result: [
          new ChromRegion('chr1:123-234'),
          new ChromRegion('chr1:240-299'),
          new ChromRegion('chr1:301-500'),
          new ChromRegion('chr1:505-1200'),
          new ChromRegion('chr1:1230-1500')
        ]
      })).to.eql([
        new ChromRegion('chr1:123-234'),
        new ChromRegion('chr1:240-1200'),
        new ChromRegion('chr1:1230-1500')
      ])
      expect(tree.hasUncachedRange(this.treeRange)).to.be.true()
      expect(tree.hasUncachedRange(this.diffChrRange)).to.be.false()
      expect(tree.getUncachedRange(this.treeRange)
        .map(range => range.toString())
      ).to.eql([this.treeRange.toString()])
      expect(tree.getUncachedRange(this.diffChrRange)
        .map(range => range.toString())
      ).to.eql([])
      expect(() => tree.insert(dataArray[0])).to.throw()
      expect(() => tree.insert()).to.throw()

      tree.insert(dataArray.slice(3, 4), null, {
        continuedList: dataArray.slice(1, 3).map(region => region.clone()),
        callback: chrRegion => (
          insertCallbackContainer.push(chrRegion.toString())
        )
      })
      expect(tree._root.childNum).to.equal(3)
      expect(insertCallbackContainer).to.eql([
        'chr1:10-11 (+)'
      ])
      expect(tree._root.values[1].continuedList)
        .to.not.have.members(this.dataArray.slice(1, 3))
      expect(tree._root.values[1].continuedList)
        .to.eql(this.dataArray.slice(1, 3))

      insertCallbackContainer = []
      tree.insert(dataArray.slice(1, 3), new ChromRegion('chr1:5-9'), {
        callback: chrRegion => (
          insertCallbackContainer.push(chrRegion.toString())
        )
      })
      expect(insertCallbackContainer).to.eql([
        'chr1:5-100 (+)',
        'chr1:5-150 (-)'
      ])

      insertCallbackContainer = []
      tree.insert(dataArray, null, {
        callback: chrRegion => (
          insertCallbackContainer.push(chrRegion.toString())
        )
      })
      expect(insertCallbackContainer).to.eql([
        'chr1:3-9',
        'chr1:5-100 (+)',
        'chr1:5-150 (-)',
        'chr1:10-11 (+)',
        'chr1:12-1200 (-)',
        'chr1:12-1200 (+)',
        'chr1:51-100',
        'chr1:123-456 (-)',
        'chr1:123-789 (+)',
        'chr1:234-789'
      ])
      expect(tree._root.childNum).to.equal(9)

      insertCallbackContainer = []
      tree.insert(dataArray, this.treeRange)
      expect(insertCallbackContainer).to.eql([])
      expect(tree._root.childNum).to.equal(8)
      expect(tree._root.reverseDepth).to.equal(0)
      expect(tree._root.values[1].start).to.equal(2)
      expect(tree._root.values[2].start).to.equal(4)
      expect(tree._root.values[2].startList)
        .to.have.members(this.dataArray.slice(1, 3))
      expect(tree._root.values[6].startList)
        .to.have.members(this.dataArray.slice(7, 9))
      expect(tree._root.values[3].continuedList)
        .to.have.members(this.dataArray.slice(1, 3))
      expect(tree._root.values[4].continuedList)
        .to.have.members(this.dataArray.slice(1, 3))
      expect(tree._root.values[5].continuedList)
        .to.have.members(this.dataArray.slice(1, 3)
          .concat(this.dataArray.slice(4, 6)))
      expect(tree._root.values[6].continuedList)
        .to.have.members(this.dataArray.slice(1, 2)
          .concat(this.dataArray.slice(4, 6)))
      expect(tree._root.values[7].continuedList)
        .to.have.members(this.dataArray.slice(4, 6)
          .concat(this.dataArray.slice(7, 9)))
      expect(tree.hasUncachedRange(this.treeRange)).to.be.false()
      expect(tree.hasUncachedRange(this.dataArray[7])).to.be.false()
      expect(() => tree._root._splitChild(7, 500)).to.throw()
    })

    it('Traverse.', function () {
      let tree = new SampleTree(this.treeRange)
      let dataArray = this.dataArray.slice()
      tree.insert(dataArray, this.treeRange)

      let dataCallbackExpected = this.dataArray.map(entry => ({
        'regionString': entry.toString(),
        args: []
      }))
      let traverseContainer = []
      let alwaysTraverseCallback = (chrRegion, props, ...args) =>
        traverseContainer.push({
          'regionString': chrRegion.toString(),
          args
        })
      let breakTraverseCallback = (chrRegion, props, ...args) =>
        (chrRegion.flag1 !== 'dataFlag 6-0' &&
          traverseContainer.push({
            'regionString': chrRegion.toString(),
            args
          })
        )
      let earlyBreakTraverseCallback = (chrRegion, props, ...args) =>
        (chrRegion.flag1 !== 'dataFlag 4-0' &&
          traverseContainer.push({
            'regionString': chrRegion.toString(),
            args
          })
        )
      let strandFilter = chrRegion => chrRegion.strand !== false
      let strandAlwaysPassFilter = chrRegion => true

      expect(tree.traverse(
        new ChromRegion('chr1:140-200'), alwaysTraverseCallback, null, false, {}
      )).to.be.true()
      expect(traverseContainer).to.eql(
        [1, 4, 5, 7, 8].map(entry => dataCallbackExpected[entry]))

      traverseContainer.length = 0
      expect(tree.traverse(
        new ChromRegion('chr1: 1-2'), alwaysTraverseCallback, null, false, {
          notFirstCall: true
        }
      )).to.be.true()
      expect(traverseContainer).to.eql([])

      expect(tree.traverse(
        new ChromRegion('chr1: 50-200'), alwaysTraverseCallback, null, true, {}
      )).to.be.true()
      expect(traverseContainer).to.eql(
        [2, 1, 4, 5, 6, 7, 8].map(entry => dataCallbackExpected[entry]))
      traverseContainer.length = 0

      expect(tree.traverse(
        new ChromRegion('chr1: 50-200'), breakTraverseCallback, null, false, {}
      )).to.be.true()
      expect(traverseContainer).to.eql(
        [2, 1, 4, 5, 6, 8].map(entry => dataCallbackExpected[entry]))
      traverseContainer.length = 0

      expect(tree.traverse(
        new ChromRegion('chr1: 50-200'), breakTraverseCallback, null, true, {}
      )).to.be.false()
      expect(traverseContainer).to.eql(
        [2, 1, 4, 5, 6].map(entry => dataCallbackExpected[entry])
      )
      traverseContainer.length = 0

      expect(tree.traverse(
        new ChromRegion('chr1: 50-200'), breakTraverseCallback,
        strandFilter, true, {}
      )).to.be.true()
      expect(traverseContainer).to.eql(
        [2, 5, 6, 8].map(entry => dataCallbackExpected[entry])
      )
      traverseContainer.length = 0

      expect(tree.traverse(
        new ChromRegion('chr1: 51-200'), breakTraverseCallback,
        strandFilter, true, { notFirstCall: true }
      )).to.be.true()
      expect(traverseContainer).to.eql(
        [6, 8].map(entry => dataCallbackExpected[entry])
      )
      traverseContainer.length = 0

      expect(tree.traverse(
        new ChromRegion('chr1: 50-200'), breakTraverseCallback,
        strandAlwaysPassFilter, true, {}, 'test1', 'test2', 3
      )).to.be.false()
      expect(traverseContainer).to.eql(
        [2, 1, 4, 5, 6].map(entry =>
          Object.assign(Object.assign({}, dataCallbackExpected[entry]), {
            args: ['test1', 'test2', 3]
          }))
      )
      traverseContainer.length = 0

      expect(tree.traverse(
        new ChromRegion('chr1: 51-200'), earlyBreakTraverseCallback,
        strandFilter, true, { notFirstCall: true }
      )).to.be.true()
      expect(traverseContainer).to.eql(
        [6, 8].map(entry => dataCallbackExpected[entry])
      )
      traverseContainer.length = 0

      expect(tree.traverse(
        new ChromRegion('chr1: 50-200'), earlyBreakTraverseCallback,
        strandAlwaysPassFilter, true, {}, 'test1', 'test2', 3
      )).to.be.false()
      expect(traverseContainer).to.eql(
        [2, 1].map(entry =>
          Object.assign(Object.assign({}, dataCallbackExpected[entry]), {
            args: ['test1', 'test2', 3]
          }))
      )
      traverseContainer.length = 0
    })
  })

  it('New localOnly tree', function () {
    let tree = new SampleTree(this.treeRange, { localOnly: true })
    let dataArray = this.dataArray.slice()
    expect(tree.hasUncachedRange(this.treeRange)).to.be.false()
    expect(tree.getUncachedRange(this.treeRange)).to.eql([])
    tree.insert([dataArray[2], dataArray[7]])
    expect(tree._root.childNum).to.equal(3)

    dataArray.splice(2, 1)
    dataArray.splice(6, 1)
    tree.insert(dataArray)

    expect(tree._root.childNum).to.equal(8)
    expect(tree._root.reverseDepth).to.equal(0)
    expect(tree._root.values[1].start).to.equal(2)
    expect(tree._root.values[2].start).to.equal(4)
    expect(tree._root.values[2].startList)
      .to.have.members(this.dataArray.slice(1, 3))
    expect(tree._root.values[6].startList)
      .to.have.members(this.dataArray.slice(7, 9))
    expect(tree._root.values[3].continuedList)
      .to.have.members(this.dataArray.slice(1, 3))
    expect(tree._root.values[4].continuedList)
      .to.have.members(this.dataArray.slice(1, 3))
    expect(tree._root.values[5].continuedList)
      .to.have.members(this.dataArray.slice(1, 3)
        .concat(this.dataArray.slice(4, 6)))
    expect(tree._root.values[6].continuedList)
      .to.have.members(this.dataArray.slice(1, 2)
        .concat(this.dataArray.slice(4, 6)))
    expect(tree._root.values[7].continuedList)
      .to.have.members(this.dataArray.slice(4, 6)
        .concat(this.dataArray.slice(7, 9)))
  })
})
