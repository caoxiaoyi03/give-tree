const GiveTrees = require('../')
const GiveTree = GiveTrees.GiveTree
const GiveTreeNode = GiveTrees.GiveTreeNode
const GiveNonLeafNode = GiveTrees.GiveNonLeafNode

const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
const expect = chai.expect

const ChromRegion = require('@givengine/chrom-region')

describe('Test if the code complains for missing required implementation',
  function () {
    before('Initialize data array.', function () {
      this.dataArray = [
        new ChromRegion('chr1:1-9', null, {
          flag1: 'dataFlag1-0'
        }),
        new ChromRegion('chr1:5-1050(-)', null, {
          flag1: 'dataFlag1-1-1'
        }),
        new ChromRegion('chr1:5-1000(+)', null, {
          flag1: 'dataFlag1-1-2'
        }),
        new ChromRegion('chr1:10-12(+)', null, {
          flag1: 'dataFlag1-2'
        }),
        new ChromRegion('chr1:12-1200(-)', null, {
          flag1: 'dataFlag1-3-1'
        }),
        new ChromRegion('chr1:12-1200(+)', null, {
          flag1: 'dataFlag1-3-2'
        }),
        new ChromRegion('chr1:51-100', null, {
          flag1: 'dataFlag1-4'
        }),
        new ChromRegion('chr1:123-456(-)', null, {
          flag1: 'dataFlag1-5'
        }),
        new ChromRegion('chr1:123-789(+)', null, {
          flag2: 'dataFlag2-1'
        }),
        new ChromRegion('chr1:234-789', null, {
          flag2: 'dataFlag2-2'
        })
      ]
      this.treeRange = new ChromRegion('chr1:1-2000')
    })

    it('GiveTreeNode', function () {
      let newNode = new GiveTreeNode()
      expect(newNode.hasData).to.be.false()
      expect(newNode.mergeAfter()).to.be.false()
      expect(() => (newNode.start = 0)).to.throw()
      expect(() => newNode.start).to.throw()
      expect(() => (newNode.end = 10)).to.throw()
      expect(() => newNode.end).to.throw()
      expect(() => newNode.insert(this.dataArray, this.treeRange)).to.throw()
      expect(() => newNode.remove(this.dataArray[0])).to.throw()
      expect(() => newNode.clear()).to.throw()
      expect(() => newNode.traverse(this.treeRange, {
        dataCallback: () => true
      })).to.throw()
      expect(() => newNode.getUncachedRange(this.treeRange)).to.throw()
      expect(() => newNode.hasUncachedRange(this.treeRange)).to.throw()
      expect(() => newNode.isEmpty).to.throw()
    })

    it('GiveTree and GiveNonLeafNode without neighbor links', function () {
      class NonLeafNodeNonImpl extends GiveNonLeafNode { }
      class LeafNodeNonImpl extends GiveTreeNode { }
      let newTree = new GiveTree(this.treeRange, {
        NonLeafNodeCtor: NonLeafNodeNonImpl,
        LeafNodeCtor: LeafNodeNonImpl
      })
      expect(newTree.coveringRange.equalTo(this.treeRange)).to.be.true()
      expect(newTree._currGen).to.equal(0)
      expect(newTree._root.childNum).to.equal(1)
      expect(newTree._root.start).to.equal(0)
      expect(newTree._root.end).to.equal(2000)
      expect(newTree._root.length).to.equal(2000)
      let newNode = new GiveNonLeafNode(newTree._root)
      expect(newNode.start).to.equal(0)
      expect(newNode.end).to.equal(2000)
      newNode.start = 1
      newNode.end = 10000
      expect(newNode.start).to.equal(1)
      expect(newNode.end).to.equal(10000)
      expect(newTree._root.start).to.equal(1)
      expect(newTree._root.end).to.equal(10000)

      expect(() => newTree.insert(this.dataArray, this.treeRange)).to.throw()
      expect(
        () => newTree._root._addLeafRecords(this.dataArray, this.treeRange)
      ).to.throw()
      expect(
        () => newTree._root._addNonLeafRecords(this.dataArray, this.treeRange)
      ).to.throw()

      expect(() => new GiveNonLeafNode()).to.throw()
      expect(() => new GiveNonLeafNode({ start: 100, end: 0 })).to.throw()
      expect(() => newTree._root.next).to.throw()
      expect(() => newTree._root.prev).to.throw()
      expect(() => (newTree._root.next = newNode)).to.throw()
      expect(() => (newTree._root.prev = newNode)).to.throw()

      let newNoWitherTree = new GiveTree(this.treeRange, {
        lifeSpan: 0,
        NonLeafNodeCtor: NonLeafNodeNonImpl,
        LeafNodeCtor: LeafNodeNonImpl
      })
      expect(newNoWitherTree._currGen).to.be.null()
    })
  }
)
