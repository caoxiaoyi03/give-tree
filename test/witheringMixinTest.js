const DataNode = require('../lib/dataNode')
const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
const expect = chai.expect
const ChromRegion = require('@givengine/chrom-region')

describe('Give tree with withering mixin tests', function () {
  before('Initialize data array.', function () {
    this.dataArray = [
      new ChromRegion('chr1:10-12', null, {
        flag1: 'dataFlag1-1'
      }),
      new ChromRegion('chr1:12-1200(-)', null, {
        flag1: 'dataFlag1-2'
      }),
      new ChromRegion('chr1:51-100', null, {
        flag1: 'dataFlag1-3'
      }),
      new ChromRegion('chr1:123-456(-)', null, {
        flag1: 'dataFlag1-4'
      }),
      new ChromRegion('chr1:123-789', null, {
        flag2: 'dataFlag2-1'
      }),
      new ChromRegion('chr1:234-789', null, {
        flag2: 'dataFlag2-2'
      })
    ]
    this.testNode = new DataNode({
      start: 122
    })
  })

  it('New Data Node', function () {
    expect(this.testNode.start).to.equal(122)
    expect(this.testNode.startList).to.eql([])
    expect(this.testNode.continuedList).to.eql([])
    expect(this.testNode.hasData).to.be.true()
    expect(this.testNode.hasUncachedRange(
      new ChromRegion('chr1:1-1000000'), null, {}
    )).to.be.false()
    expect(this.testNode.getUncachedRange(
      new ChromRegion('chr1:1-1000000'), null, {}
    )).to.eql([])
    expect(this.testNode.isEmpty).to.be.true()
    this.testNode.insert([])
    expect(this.testNode.isEmpty).to.be.true()
    expect(new DataNode(this.testNode)).to.be.eql(this.testNode)
  })
})
