const DataNode = require('../').DataNode
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
    this.testNode.insert([], new ChromRegion('chr1:1-1000000'))
    expect(this.testNode.isEmpty).to.be.true()
    expect(new DataNode(this.testNode)).to.be.eql(this.testNode)
  })

  it('Insert data into testNode', function () {
    let insertCallbackContainer = []
    let dataArrayInsert = this.dataArray.slice()
    let props = {
      callback: chrRegion => (
        insertCallbackContainer.push(chrRegion.toString())
      )
    }
    expect(this.testNode.insert(dataArrayInsert,
      new ChromRegion('chr1:1-1000000'), props)
    ).to.equal(this.testNode)
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
    expect(this.testNode.insert(dataArrayInsert,
      new ChromRegion('chr1:1-10000'), props)
    ).to.equal(this.testNode)
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
    this.testNode.insert(this.dataArray, new ChromRegion('chr1:1-10000'), props)
    let removeCallbackContainer = []
    let dataToRemove = new ChromRegion('chr1:123-789', null, {
      flag2: 'dataFlag2-1'
    })
    let rmProps = {
      exactMatch: true,
      convertTo: null,
      callback: chrRegion => (
        removeCallbackContainer.push(chrRegion.toString())
      )
    }
    expect(this.testNode.remove(dataToRemove, rmProps))
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
    this.testNode.remove(props.continuedList[0], rmProps)
    expect(this.testNode.continuedList).to.eql([this.dataArray[1]])
    this.testNode.remove(this.dataArray[1], rmProps)
    expect(this.testNode.continuedList).to.eql([])
    expect(this.testNode.remove(this.dataArray[3], rmProps))
      .to.equal(false)
    expect(removeCallbackContainer).to.eql([
      'chr1:123-789', 'chr1:1-1200', 'chr1:12-1200 (-)', 'chr1:123-456 (-)'
    ])
    expect(this.testNode.isEmpty).to.be.true()
    this.testNode.insert(this.dataArray, new ChromRegion('chr1:1-10000'), props)
    expect(this.testNode.remove(dataToRemove, rmProps))
    expect(this.testNode.startList).to.eql([])
    this.testNode.clear()
    this.testNode.insert(this.dataArray, new ChromRegion('chr1:1-10000'), props)
    expect(this.testNode.remove(this.testNode, true)).to.be.false()
    expect(this.testNode.isEmpty).to.be.true()
    this.testNode.insert(this.dataArray, new ChromRegion('chr1:1-10000'), props)
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
    this.testNode.insert(this.dataArray, new ChromRegion('chr1:1-10000'), props)
    let traverseContainer = []
    let alwaysTraverseCallback = (chrRegion, chrRange, props, ...args) =>
      traverseContainer.push({
        'regionString': chrRegion.toString(),
        args
      })
    let breakTraverseCallback = (chrRegion, chrRange, props, ...args) =>
      (chrRegion.flag1 !== 'dataFlag1-4' &&
        traverseContainer.push({
          'regionString': chrRegion.toString(),
          args
        })
      )
    let earlyBreakTraverseCallback = (chrRegion, chrRange, props, ...args) =>
      (chrRegion.flag1 !== 'dataFlag1-2' &&
        traverseContainer.push({
          'regionString': chrRegion.toString(),
          args
        })
      )
    let strandFilter = chrRegion => chrRegion.strand !== false
    let strandAlwaysPassFilter = chrRegion => true

    expect(this.testNode.traverse(new ChromRegion('chr1: 1-2'), {
      dataCallback: alwaysTraverseCallback
    })).to.be.true()
    expect(traverseContainer).to.eql([{
      regionString: 'chr1:1-1200',
      args: []
    }])

    traverseContainer.length = 0
    expect(this.testNode.traverse(new ChromRegion('chr1: 1-2'), {
      dataCallback: alwaysTraverseCallback,
      notFirstCall: true
    })).to.be.true()
    expect(traverseContainer).to.eql([])

    expect(this.testNode.traverse(new ChromRegion('chr1: 50-200'), {
      dataCallback: alwaysTraverseCallback,
      breakOnFalse: true
    })).to.be.true()
    expect(traverseContainer).to.eql([{
      regionString: 'chr1:1-1200',
      args: []
    }, {
      regionString: 'chr1:12-1200 (-)',
      args: []
    }, {
      regionString: 'chr1:123-456 (-)',
      args: []
    }, {
      regionString: 'chr1:123-789',
      args: []
    }])
    traverseContainer.length = 0

    expect(this.testNode.traverse(new ChromRegion('chr1: 50-200'), {
      dataCallback: breakTraverseCallback
    })).to.be.true()
    expect(traverseContainer).to.eql([{
      regionString: 'chr1:1-1200',
      args: []
    }, {
      regionString: 'chr1:12-1200 (-)',
      args: []
    }, {
      regionString: 'chr1:123-789',
      args: []
    }])
    traverseContainer.length = 0

    expect(this.testNode.traverse(new ChromRegion('chr1: 50-200'), {
      dataCallback: breakTraverseCallback,
      breakOnFalse: true
    })).to.be.false()
    expect(traverseContainer).to.eql([{
      regionString: 'chr1:1-1200',
      args: []
    }, {
      regionString: 'chr1:12-1200 (-)',
      args: []
    }])
    traverseContainer.length = 0

    expect(this.testNode.traverse(new ChromRegion('chr1: 50-200'), {
      dataCallback: breakTraverseCallback,
      dataFilter: strandFilter,
      breakOnFalse: true
    })).to.be.true()
    expect(traverseContainer).to.eql([{
      regionString: 'chr1:1-1200',
      args: []
    }, {
      regionString: 'chr1:123-789',
      args: []
    }])
    traverseContainer.length = 0

    expect(this.testNode.traverse(new ChromRegion('chr1: 50-200'), {
      dataCallback: breakTraverseCallback,
      dataFilter: strandFilter,
      breakOnFalse: true,
      notFirstCall: true
    })).to.be.true()
    expect(traverseContainer).to.eql([{
      regionString: 'chr1:123-789',
      args: []
    }])
    traverseContainer.length = 0

    expect(this.testNode.traverse(new ChromRegion('chr1: 50-200'), {
      dataCallback: breakTraverseCallback,
      dataFilter: strandAlwaysPassFilter,
      breakOnFalse: true
    }, 'test1', 'test2', 3)).to.be.false()
    expect(traverseContainer).to.eql([{
      regionString: 'chr1:1-1200',
      args: ['test1', 'test2', 3]
    }, {
      regionString: 'chr1:12-1200 (-)',
      args: ['test1', 'test2', 3]
    }])
    traverseContainer.length = 0

    expect(this.testNode.traverse(new ChromRegion('chr1: 50-200'), {
      dataCallback: earlyBreakTraverseCallback,
      dataFilter: strandFilter,
      breakOnFalse: true,
      notFirstCall: true
    })).to.be.true()
    expect(traverseContainer).to.eql([{
      regionString: 'chr1:123-789',
      args: []
    }])
    traverseContainer.length = 0

    expect(this.testNode.traverse(new ChromRegion('chr1: 50-200'), {
      dataCallback: earlyBreakTraverseCallback,
      dataFilter: strandAlwaysPassFilter,
      breakOnFalse: true
    }, 'test1', 'test2', 3)).to.be.false()
    expect(traverseContainer).to.eql([{
      regionString: 'chr1:1-1200',
      args: ['test1', 'test2', 3]
    }])
    traverseContainer.length = 0
  })

  it('Merge after and updateContinuedList', function () {
    let prevNode = [
      new DataNode({ start: 50 }),
      new DataNode({ start: 99 })
    ]
    let laterDataArray = this.dataArray.map(chrRegion => chrRegion.clone())
    laterDataArray[1].flag1 = 'dataFlag1-2-later'
    let propsPrev = { dataIndex: 0 }
    let propsLater = { dataIndex: 0 }
    this.testNode.insert(laterDataArray,
      new ChromRegion('chr1:1-10000'), propsLater)
    prevNode[0].insert(this.dataArray,
      new ChromRegion('chr1:1-10000'), propsPrev)
    prevNode[1].insert(this.dataArray,
      new ChromRegion('chr1:1-10000'), propsPrev)
    expect(this.testNode.continuedList).to.have.lengthOf(1)
      .and.to.include.members(laterDataArray.slice(1, 2))
      .and.to.not.include.members(this.dataArray.slice(1, 2))
    expect(prevNode[0].continuedList).to.have.lengthOf(1)
      .and.to.include.members(this.dataArray.slice(1, 2))
    expect(prevNode[1].continuedList).to.have.lengthOf(2)
      .and.to.include.members(this.dataArray.slice(1, 3))
    expect(prevNode[0].mergeAfter(null)).to.be.false()
    expect(prevNode[0].mergeAfter(false)).to.be.true()
    expect(prevNode[0].mergeAfter(prevNode[1])).to.be.true()

    expect(() => this.testNode._updateContinuedList([], true)).to.throw()
    expect(this.testNode._updateContinuedList())
      .to.be.eql(propsLater.continuedList)

    expect(prevNode[0].mergeAfter(this.testNode)).to.be.false()
    expect(this.testNode.continuedList).to.have.lengthOf(1)
      .and.to.include.members(this.dataArray.slice(1, 2))
      .and.to.not.include.members(laterDataArray.slice(1, 2))
  })
})
