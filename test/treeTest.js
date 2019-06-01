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
  })

  it('New unimplemented tree', function () {
    let props = {
      LeafNodeCtor: DataNode
    }
    let newTree = new GiveTree(this.treeRange, GiveTreeNode, props)
    expect(newTree).to.be.instanceOf(GiveTree)
    expect(() => newTree.insert(this.dataArray, this.treeRange)).to.throw()
  })
})
