const DataNode = require('../dataNode')
const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
const expect = chai.expect
const ChromRegion = require('@givengine/chrom-region')

describe('Data Node tests', function () {
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
  })

  it('Insert data into testNode', function () {
    let insertCallbackContainer = []
    let dataArrayInsert = this.dataArray.slice()
    let props = {
      callback: chrRegion => (
        insertCallbackContainer.push(chrRegion.toString())
      )
    }
    expect(this.testNode.insert(dataArrayInsert, null, props))
      .to.equal(this.testNode)
    expect(this.testNode.startList).to.eql([
      new ChromRegion('chr1:123-456(-)', null, {
        flag1: 'dataFlag1-4'
      }),
      new ChromRegion('chr1:123-789', null, {
        flag2: 'dataFlag2-1'
      })
    ])
    expect(this.testNode.continuedList).to.eql([
      new ChromRegion('chr1:12-1200(-)', null, {
        flag1: 'dataFlag1-2'
      })
    ])
    expect(dataArrayInsert).to.eql([
      new ChromRegion('chr1:234-789', null, {
        flag2: 'dataFlag2-2'
      })
    ])
    expect(insertCallbackContainer).to.eql([
      'chr1:10-12',
      'chr1:12-1200 (-)',
      'chr1:51-100',
      'chr1:123-456 (-)',
      'chr1:123-789'
    ])
    expect(props.continuedList).to.eql([
      new ChromRegion('chr1:12-1200(-)', null, {
        flag1: 'dataFlag1-2'
      }),
      new ChromRegion('chr1:123-456(-)', null, {
        flag1: 'dataFlag1-4'
      }),
      new ChromRegion('chr1:123-789', null, {
        flag2: 'dataFlag2-1'
      })
    ])
    expect(this.testNode.isEmpty).to.be.false()
    this.testNode.clear()
    expect(this.testNode.isEmpty).to.be.true()
  })

  it('Insert data into testNode with dataIndex and continuedList', function () {
    let insertCallbackContainer = []
    let dataArrayInsert = this.dataArray.slice()
    let props = {
      callback: chrRegion => (
        insertCallbackContainer.push(chrRegion.toString())
      ),
      continuedList: [
        new ChromRegion('chr1:1-1200', null, {
          flag0: 'dataFlag0-1'
        }),
        new ChromRegion('chr1:2-120', null, {
          flag0: 'dataFlag0-2'
        }),
        new ChromRegion('chr1:10-12', null, {
          flag1: 'dataFlag1-1'
        })
      ],
      dataIndex: 1
    }
    expect(this.testNode.insert(dataArrayInsert, null, props))
      .to.equal(this.testNode)
    expect(this.testNode.startList).to.eql([
      new ChromRegion('chr1:123-456(-)', null, {
        flag1: 'dataFlag1-4'
      }),
      new ChromRegion('chr1:123-789', null, {
        flag2: 'dataFlag2-1'
      })
    ])
    expect(this.testNode.continuedList).to.eql([
      new ChromRegion('chr1:1-1200', null, {
        flag0: 'dataFlag0-1'
      }),
      new ChromRegion('chr1:12-1200(-)', null, {
        flag1: 'dataFlag1-2'
      })
    ])
    expect(dataArrayInsert).to.eql(this.dataArray)
    expect(insertCallbackContainer).to.eql([
      'chr1:12-1200 (-)', 'chr1:51-100', 'chr1:123-456 (-)', 'chr1:123-789'
    ])
    expect(props.continuedList).to.eql([
      new ChromRegion('chr1:1-1200', null, {
        flag0: 'dataFlag0-1'
      }),
      new ChromRegion('chr1:12-1200(-)', null, {
        flag1: 'dataFlag1-2'
      }),
      new ChromRegion('chr1:123-456(-)', null, {
        flag1: 'dataFlag1-4'
      }),
      new ChromRegion('chr1:123-789', null, {
        flag2: 'dataFlag2-1'
      })
    ])
    expect(props.dataIndex).to.equal(5)
    expect(this.testNode.isEmpty).to.be.false()
    this.testNode.clear()
    expect(this.testNode.isEmpty).to.be.true()
  })

  it('Remove data from testNode', function () {
    let props = {
      continuedList: [
        new ChromRegion('chr1:1-1200', null, {
          flag0: 'dataFlag0-1'
        }),
        new ChromRegion('chr1:2-120', null, {
          flag0: 'dataFlag0-2'
        })
      ],
      dataIndex: 0
    }
    this.testNode.insert(this.dataArray, null, props)
    let removeCallbackContainer = []
    let dataToRemove = new ChromRegion('chr1:123-789', null, {
      flag2: 'dataFlag2-1'
    })
    let rmProps = {
      callback: chrRegion => (
        removeCallbackContainer.push(chrRegion.toString())
      )
    }
    expect(this.testNode.remove(dataToRemove, true, null, rmProps))
      .to.equal(this.testNode)
    expect(this.testNode.startList).to.eql([
      new ChromRegion('chr1:123-456(-)', null, {
        flag1: 'dataFlag1-4'
      })
    ])
    expect(this.testNode.continuedList).to.eql([
      new ChromRegion('chr1:1-1200', null, {
        flag0: 'dataFlag0-1'
      }),
      new ChromRegion('chr1:12-1200(-)', null, {
        flag1: 'dataFlag1-2'
      })
    ])
    expect(removeCallbackContainer).to.eql([
      'chr1:123-789'
    ])
    expect(this.testNode.isEmpty).to.be.false()
    this.testNode.remove(props.continuedList[0], true, null, rmProps)
    expect(this.testNode.continuedList).to.eql([this.dataArray[1]])
    this.testNode.remove(this.dataArray[1], true, null, rmProps)
    expect(this.testNode.continuedList).to.eql([])
    expect(this.testNode.remove(this.dataArray[3], true, null, rmProps))
      .to.equal(false)
    expect(removeCallbackContainer).to.eql([
      'chr1:123-789', 'chr1:1-1200', 'chr1:12-1200 (-)', 'chr1:123-456 (-)'
    ])
    expect(this.testNode.isEmpty).to.be.true()
    this.testNode.insert(this.dataArray, null, props)
    expect(this.testNode.remove(dataToRemove, false, null, rmProps))
    expect(this.testNode.startList).to.eql([])
    this.testNode.clear()
    this.testNode.insert(this.dataArray, null, props)
    expect(this.testNode.remove(this.testNode, true)).to.be.false()
    expect(this.testNode.isEmpty).to.be.true()
    this.testNode.insert(this.dataArray, null, props)
    expect(this.testNode.remove(this.testNode, false)).to.be.false()
    expect(this.testNode.isEmpty).to.be.true()
  })

  it('Traverse', function () {
    let props = {
      continuedList: [
        new ChromRegion('chr1:1-1200', null, {
          flag0: 'dataFlag0-1'
        }),
        new ChromRegion('chr1:2-120', null, {
          flag0: 'dataFlag0-2'
        })
      ],
      dataIndex: 0
    }
    this.testNode.insert(this.dataArray, null, props)
    let traverseContainer = []
    let alwaysTraverseCallback = chrRegion =>
      traverseContainer.push(chrRegion.toString())
    let breakTraverseCallback = chrRegion =>
      (chrRegion.flag1 !== 'dataFlag1-4' &&
      traverseContainer.push(chrRegion.toString()))

    let travProps = {
      callback: chrRegion => (
        traverseContainer.push(chrRegion.toString())
      )
    }
    expect(this.testNode.remove(dataToRemove, true, null, rmProps))
      .to.equal(this.testNode)
    expect(this.testNode.startList).to.eql([
      new ChromRegion('chr1:123-456(-)', null, {
        flag1: 'dataFlag1-4'
      })
    ])
    expect(this.testNode.continuedList).to.eql([
      new ChromRegion('chr1:1-1200', null, {
        flag0: 'dataFlag0-1'
      }),
      new ChromRegion('chr1:12-1200(-)', null, {
        flag1: 'dataFlag1-2'
      })
    ])
    expect(removeCallbackContainer).to.eql([
      'chr1:123-789'
    ])
    expect(this.testNode.isEmpty).to.be.false()
    this.testNode.remove(props.continuedList[0], true, null, rmProps)
    expect(this.testNode.continuedList).to.eql([this.dataArray[1]])
    this.testNode.remove(this.dataArray[1], true, null, rmProps)
    expect(this.testNode.continuedList).to.eql([])
    expect(this.testNode.remove(this.dataArray[3], true, null, rmProps))
      .to.equal(false)
    expect(removeCallbackContainer).to.eql([
      'chr1:123-789', 'chr1:1-1200', 'chr1:12-1200 (-)', 'chr1:123-456 (-)'
    ])
    expect(this.testNode.isEmpty).to.be.true()
    this.testNode.insert(this.dataArray, null, props)
    expect(this.testNode.remove(dataToRemove, false, null, rmProps))
    expect(this.testNode.startList).to.eql([])
    this.testNode.clear()
    this.testNode.insert(this.dataArray, null, props)
    expect(this.testNode.remove(this.testNode, true)).to.be.false()
    expect(this.testNode.isEmpty).to.be.true()
    this.testNode.insert(this.dataArray, null, props)
    expect(this.testNode.remove(this.testNode, false)).to.be.false()
    expect(this.testNode.isEmpty).to.be.true()
  })
})
