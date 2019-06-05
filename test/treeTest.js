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
    this.nonOverlappingRange = new ChromRegion('chr1:2002-4000')
    this.diffChrRange = new ChromRegion('chr2:1-1000')
  })

  it('New sample tree', function () {
    let tree = new SampleTree(this.treeRange)
    let dataArray = this.dataArray.slice()
    expect(tree).to.be.instanceOf(GiveTree)
    expect(() =>
      tree._root.truncateChrRange(this.nonOverlappingRange, true, true, false)
    ).to.throw()
    expect(tree._root.isEmpty).to.be.false()
    expect(tree.hasUncachedRange(this.treeRange)).to.be.true()
    expect(tree.hasUncachedRange(this.diffChrRange)).to.be.false()
    expect(tree.getUncachedRange(this.treeRange)
      .map(range => range.toString())
    ).to.eql([this.treeRange.toString()])
    expect(tree.getUncachedRange(this.diffChrRange)
      .map(range => range.toString())
    ).to.eql([])

    tree.insert(dataArray, this.treeRange)
    expect(tree._root.childNum).to.equal(7)
    expect(tree._root.reverseDepth).to.equal(0)
    expect(tree._root.values[0].start).to.equal(0)
    expect(tree._root.values[1].start).to.equal(4)
    expect(tree._root.values[1].startList).to.eql(this.dataArray.slice(1, 3))
    expect(tree._root.values[5].startList).to.eql(this.dataArray.slice(7, 9))
    expect(tree.hasUncachedRange(this.treeRange)).to.be.false()
  })
})
