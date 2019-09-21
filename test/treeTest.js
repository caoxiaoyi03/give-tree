const GiveTrees = require('../')
const GiveTree = GiveTrees.GiveTree
const GiveTreeNode = GiveTrees.GiveTreeNode
const SampleTree = require('../lib/sampleTree')

const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
const expect = chai.expect

const ChromRegion = require('@givengine/chrom-region')

describe('Give tree tests', function () {
  before('Initialize data array.', function () {
    this.dataArray = [
      new ChromRegion('chr1:3-8', null, { // 0
        flag1: 'dataFlag 1-0'
      }),
      new ChromRegion('chr1:5-150(-)', null, { // 1
        flag1: 'dataFlag 2-0'
      }),
      new ChromRegion('chr1:5-100(+)', null, { // 2
        flag1: 'dataFlag 2-1'
      }),
      new ChromRegion('chr1:9-10(+)', null, { // 3
        flag1: 'dataFlag 3-0'
      }),
      new ChromRegion('chr1:12-1200(-)', null, { // 4
        flag1: 'dataFlag 4-0'
      }),
      new ChromRegion('chr1:12-1201(+)', null, { // 5
        flag1: 'dataFlag 4-1'
      }),
      new ChromRegion('chr1:51-100', null, { // 6
        flag1: 'dataFlag 5-0'
      }),
      new ChromRegion('chr1:123-456(-)', null, { // 7
        flag1: 'dataFlag 6-0'
      }),
      new ChromRegion('chr1:123-789(+)', null, { // 8
        flag1: 'dataFlag 6-1',
        flag2: 'dataFlag2 6-1'
      }),
      new ChromRegion('chr1:234-789', null, { // 9
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
    before('Sample tree preparation', function () {
      this.tree = new SampleTree(this.treeRange)
      this.additionalArgs = ['arg1', 2, 'arg3', null]

      this.insertCallbackContainer = []
      this.insertCallback = (chrRegion, chrRange, props, ...args) => (
        this.insertCallbackContainer.push({
          regionString: chrRegion.toString(),
          args
        })
      )

      this.traverseContainer = []
      this.alwaysTraverseCallback = (chrRegion, chrRange, props, ...args) =>
        this.traverseContainer.push({
          'regionString': chrRegion.toString(),
          args
        })
      this.breakTraverseCallback = (chrRegion, chrRange, props, ...args) =>
        (chrRegion.flag1 !== 'dataFlag 6-0' &&
          this.traverseContainer.push({
            'regionString': chrRegion.toString(),
            args
          })
        )
      this.earlyBreakTraverseCallback = (chrRegion, chrRange, props, ...args) =>
        (chrRegion.flag1 !== 'dataFlag 4-0' &&
          this.traverseContainer.push({
            'regionString': chrRegion.toString(),
            args
          })
        )
      this.strandFilter = chrRegion => chrRegion.strand !== false
      this.strandAlwaysPassFilter = chrRegion => true

      this.expectedArray = this.dataArray.map(entry => ({
        regionString: entry.toString(),
        args: []
      }))
      this.expectedArrayWithArgs = this.dataArray.map(entry => ({
        regionString: entry.toString(),
        args: this.additionalArgs
      }))
    })

    it('UncachedRanges.', function () {
      expect(this.tree).to.be.instanceOf(GiveTree)
      expect(() =>
        this.tree._root.truncateChrRange(this.nonOverlappingRange, true, true, false)
      ).to.throw()
      expect(this.tree._root.isEmpty).to.be.false()
      expect(this.tree._root.getUncachedRange(new ChromRegion('chr1:300-1000'), {
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
      expect(this.tree.hasUncachedRange(this.treeRange)).to.be.true()
      expect(this.tree.hasUncachedRange(this.diffChrRange)).to.be.false()
      expect(this.tree.getUncachedRange(this.treeRange)
        .map(range => range.toString())
      ).to.eql([this.treeRange.toString()])
      expect(this.tree.getUncachedRange(this.diffChrRange)
        .map(range => range.toString())
      ).to.eql([])
    })

    it('Insert and clear.', function () {
      let dataArray = this.dataArray.slice()
      expect(() => this.tree.insert(dataArray[0])).to.throw()
      expect(() => this.tree.insert()).to.throw()

      this.tree.insert(dataArray.slice(3, 4), null, {
        continuedList: dataArray.slice(1, 3).map(region => region.clone()),
        dataCallback: this.insertCallback
      })
      expect(this.tree._root.childNum).to.equal(3)
      expect(this.insertCallbackContainer).to.eql(
        [2, 1, 3].map(index => this.expectedArray[index])
      )
      expect(this.tree._root.values[1].continuedList)
        .to.not.have.members(this.dataArray.slice(1, 3))
      expect(this.tree._root.values[1].continuedList)
        .to.eql(this.dataArray.slice(1, 3).sort(ChromRegion.compare))

      this.insertCallbackContainer.length = 0
      this.tree.insert(dataArray.slice(0, 3), new ChromRegion('chr1:5-9'), {
        dataCallback: this.insertCallback
      })
      expect(this.insertCallbackContainer).to.eql(
        [0, 2, 1].map(index => this.expectedArray[index])
      )

      expect(() => this.tree.insert(dataArray.slice(4, 5), null, {
        dataCallback: this.insertCallback,
        continuedList: [
          new ChromRegion('chr1: 6-10')
        ]
      })).to.throw()

      this.insertCallbackContainer.length = 0
      this.tree.insert(dataArray, null, {
        dataCallback: this.insertCallback
      }, ...this.additionalArgs)
      expect(this.insertCallbackContainer).to.eql(
        [0, 4, 5, 6, 7, 8, 9].map(index => this.expectedArrayWithArgs[index])
      )
      expect(this.tree._root.childNum).to.equal(9)
      expect(dataArray).to.eql([])

      this.insertCallbackContainer.length = 0
      this.tree.insert(dataArray, this.treeRange)
      expect(this.insertCallbackContainer).to.eql([])
      expect(this.tree._root.childNum).to.equal(8)
      expect(this.tree._root.reverseDepth).to.equal(0)
      expect(this.tree._root.values[1].start).to.equal(2)
      expect(this.tree._root.values[2].start).to.equal(4)
      expect(this.tree._root.values[2].startList)
        .to.have.members(this.dataArray.slice(1, 3))
      expect(this.tree._root.values[6].startList)
        .to.have.members(this.dataArray.slice(7, 9))
      expect(this.tree._root.values[3].continuedList)
        .to.have.members(this.dataArray.slice(1, 3))
      expect(this.tree._root.values[4].continuedList)
        .to.have.members(this.dataArray.slice(1, 3))
      expect(this.tree._root.values[5].continuedList)
        .to.have.members(this.dataArray.slice(1, 3)
          .concat(this.dataArray.slice(4, 6)))
      expect(this.tree._root.values[6].continuedList)
        .to.have.members(this.dataArray.slice(1, 2)
          .concat(this.dataArray.slice(4, 6)))
      expect(this.tree._root.values[7].continuedList)
        .to.have.members(this.dataArray.slice(4, 6)
          .concat(this.dataArray.slice(7, 9)))
      expect(this.tree.hasUncachedRange(this.treeRange)).to.be.false()
      expect(this.tree.hasUncachedRange(this.dataArray[7])).to.be.false()
      expect(() => this.tree._root._splitChild(7, 500)).to.throw()

      this.tree.clear()
      expect(this.tree.hasUncachedRange(this.treeRange)).to.be.true()
      expect(this.tree.hasUncachedRange(this.diffChrRange)).to.be.false()
      expect(this.tree.getUncachedRange(this.treeRange))
        .to.eql([this.treeRange])
    })

    it('Data consistency during insertion.', function () {
      let dataArray = this.dataArray.slice()
      let contListClone1 = [1, 4, 5].map(index => dataArray[index].clone())
      let contListClone2 = [1, 2].map(index => dataArray[index].clone())
      let contListClone3 = [1, 2].map(index => dataArray[index].clone())
      expect(contListClone2).to.not.include.any.members(contListClone3)

      this.insertCallbackContainer.length = 0
      this.tree.insert(dataArray.slice(7, 9), new ChromRegion('chr1:123-233'), {
        dataCallback: this.insertCallback,
        continuedList: contListClone1.slice()
      })
      expect(this.insertCallbackContainer).to.eql(
        [1, 4, 5, 7, 8].map(index => this.expectedArray[index]))
      expect(this.tree._root.values[1].continuedList)
        .to.not.include.members([1, 4, 5].map(index => dataArray[index]))
      expect(this.tree._root.values[1].continuedList)
        .to.have.members(contListClone1)
      expect(this.tree._root.values[1].continuedList)
        .to.eql([1, 4, 5].map(index => dataArray[index]))

      this.insertCallbackContainer.length = 0
      this.tree.insert(dataArray.slice(3, 4), null, {
        dataCallback: this.insertCallback,
        continuedList: contListClone2.slice()
      })
      expect(this.tree._root.childNum).to.equal(5)
      expect(this.insertCallbackContainer).to.eql(
        [2, 1, 3].map(index => this.expectedArray[index]))
      expect(this.tree._root.values[1].continuedList)
        .to.not.include.any.members([2, 1].map(index => dataArray[index]))
      expect(this.tree._root.values[1].continuedList)
        .to.eql([2, 1].map(index => dataArray[index]))

      expect(this.tree._root.values[3].continuedList)
        .to.not.include.members([1, 4, 5].map(index => dataArray[index]))
      expect(this.tree._root.values[3].continuedList)
        .to.include.members([this.tree._root.values[1].continuedList[1]])
      expect(this.tree._root.values[3].continuedList)
        .to.not.include.members([contListClone1[0]])

      this.insertCallbackContainer.length = 0
      this.tree.insert(dataArray.slice(4, 6), new ChromRegion('chr1:12-50'), {
        dataCallback: this.insertCallback,
        continuedList: contListClone3.slice()
      })
      expect(this.tree._root.childNum).to.equal(7)
      expect(this.insertCallbackContainer).to.eql(
        [4, 5].map(index => this.expectedArray[index]))
      expect(this.tree._root.values[1].continuedList)
        .to.have.members(contListClone2)
      expect(this.tree._root.values[1].continuedList)
        .to.not.include.any.members(contListClone3)

      expect(this.tree._root.values[3].continuedList)
        .to.not.include.any.members(contListClone3)
      expect(this.tree._root.values[3].continuedList)
        .to.have.members(contListClone2)

      expect(this.tree._root.values[5].continuedList)
        .to.not.include.members([1].map(index => dataArray[index]))
      expect(this.tree._root.values[5].continuedList)
        .to.include.members(dataArray.slice(4, 6))
      expect(this.tree._root.values[5].continuedList)
        .to.include.members([this.tree._root.values[1].continuedList[1]])
      expect(this.tree._root.values[5].continuedList)
        .to.not.include.members([contListClone1[0]])
      expect(this.tree._root.values[5].continuedList)
        .to.not.include.members([contListClone3[0]])

      this.insertCallbackContainer.length = 0
      this.tree.insert(dataArray.slice(1, 3), new ChromRegion('chr1:5-8'), {
        dataCallback: this.insertCallback,
        continuedList: [dataArray[0].clone()]
      })
      expect(this.tree._root.childNum).to.equal(8)
      expect(this.insertCallbackContainer).to.eql(
        [0, 2, 1].map(index => this.expectedArray[index]))
      expect(this.tree._root.values[1].continuedList)
        .to.not.include.members([dataArray[0]])
      expect(this.tree._root.values[1].continuedList)
        .to.eql([dataArray[0]])

      expect(this.tree._root.values[4].continuedList)
        .to.not.include.any.members(contListClone2)
      expect(this.tree._root.values[4].continuedList)
        .to.have.members(dataArray.slice(1, 3))

      expect(this.tree._root.values[6].continuedList)
        .to.include.members([1, 4, 5].map(index => dataArray[index]))
      expect(this.tree._root.values[6].continuedList)
        .to.include.members([this.tree._root.values[1].startList[1]])
      expect(this.tree._root.values[6].continuedList)
        .to.not.include.members([contListClone2[0]])

      this.insertCallbackContainer.length = 0
      this.tree.insert(dataArray, null, {
        dataCallback: this.insertCallback
      }, ...this.additionalArgs)
      expect(this.tree._root.childNum).to.equal(9)
      expect(this.insertCallbackContainer).to.eql(
        [0, 6, 9].map(index => this.expectedArrayWithArgs[index])
      )

      this.insertCallbackContainer.length = 0
      this.tree.insert(dataArray, this.treeRange)
      expect(this.insertCallbackContainer).to.eql([])
      expect(this.tree._root.childNum).to.equal(8)
      expect(this.tree._root.reverseDepth).to.equal(0)
      expect(this.tree._root.values[1].start).to.equal(2)
      expect(this.tree._root.values[2].start).to.equal(4)
      expect(this.tree._root.values[2].startList)
        .to.have.members(this.dataArray.slice(1, 3))
      expect(this.tree._root.values[6].startList)
        .to.have.members(this.dataArray.slice(7, 9))
      expect(this.tree._root.values[3].continuedList)
        .to.have.members(this.dataArray.slice(1, 3))
      expect(this.tree._root.values[4].continuedList)
        .to.have.members(this.dataArray.slice(1, 3))
      expect(this.tree._root.values[5].continuedList)
        .to.have.members(this.dataArray.slice(1, 3)
          .concat(this.dataArray.slice(4, 6)))
      expect(this.tree._root.values[6].continuedList)
        .to.have.members(this.dataArray.slice(1, 2)
          .concat(this.dataArray.slice(4, 6)))
      expect(this.tree._root.values[7].continuedList)
        .to.have.members(this.dataArray.slice(4, 6)
          .concat(this.dataArray.slice(7, 9)))
      expect(this.tree.hasUncachedRange(this.treeRange)).to.be.false()
      expect(this.tree.hasUncachedRange(this.dataArray[7])).to.be.false()
      expect(() => this.tree._root._splitChild(7, 500)).to.throw()
    })

    it('Traverse.', function () {
      this.tree.insert(this.dataArray.slice(), this.treeRange)

      expect(() => this.tree.traverse(new ChromRegion('chr1:140-200'), null))
        .to.throw()
      expect(this.tree.traverse(new ChromRegion('chr1:140-200'), {
        nodeCallback: node => true,
        nodeFilter: node => false
      })).to.be.true()
      expect(this.tree.traverse(new ChromRegion('chr2:140-200'), {
        nodeCallback: node => true,
        nodeFilter: node => false
      })).to.be.true()

      expect(this.tree.traverse(new ChromRegion('chr1:140-200'), {
        dataCallback: this.alwaysTraverseCallback
      })).to.be.true()
      expect(this.traverseContainer).to.eql(
        [1, 4, 5, 7, 8].map(entry => this.expectedArray[entry]))

      this.traverseContainer.length = 0
      expect(this.tree.traverse(new ChromRegion('chr1: 1-2'), {
        notFirstCall: true,
        dataCallback: this.alwaysTraverseCallback
      })).to.be.true()
      expect(this.traverseContainer).to.eql([])

      expect(this.tree.traverse(new ChromRegion('chr1: 50-200'), {
        breakOnFalse: true,
        dataCallback: this.alwaysTraverseCallback
      })).to.be.true()
      expect(this.traverseContainer).to.eql(
        [2, 1, 4, 5, 6, 7, 8].map(entry => this.expectedArray[entry]))
      this.traverseContainer.length = 0

      expect(this.tree.traverse(new ChromRegion('chr1: 50-200'), {
        dataCallback: this.breakTraverseCallback
      })).to.be.true()
      expect(this.traverseContainer).to.eql(
        [2, 1, 4, 5, 6, 8].map(entry => this.expectedArray[entry]))
      this.traverseContainer.length = 0

      expect(this.tree.traverse(new ChromRegion('chr1: 50-200'), {
        breakOnFalse: true,
        dataCallback: this.breakTraverseCallback
      })).to.be.false()
      expect(this.traverseContainer).to.eql(
        [2, 1, 4, 5, 6].map(entry => this.expectedArray[entry])
      )
      this.traverseContainer.length = 0

      expect(this.tree.traverse(new ChromRegion('chr1: 50-200'), {
        breakOnFalse: true,
        dataFilter: this.strandFilter,
        dataCallback: this.breakTraverseCallback
      })).to.be.true()
      expect(this.traverseContainer).to.eql(
        [2, 5, 6, 8].map(entry => this.expectedArray[entry])
      )
      this.traverseContainer.length = 0

      expect(this.tree.traverse(new ChromRegion('chr1: 51-200'), {
        breakOnFalse: true,
        dataFilter: this.strandFilter,
        dataCallback: this.breakTraverseCallback,
        notFirstCall: true
      })).to.be.true()
      expect(this.traverseContainer).to.eql(
        [6, 8].map(entry => this.expectedArray[entry])
      )
      this.traverseContainer.length = 0

      expect(this.tree.traverse(new ChromRegion('chr1: 50-200'), {
        breakOnFalse: true,
        dataFilter: this.strandAlwaysPassFilter,
        dataCallback: this.breakTraverseCallback
      }, ...this.additionalArgs)).to.be.false()
      expect(this.traverseContainer).to.eql(
        [2, 1, 4, 5, 6].map(entry => this.expectedArrayWithArgs[entry])
      )
      this.traverseContainer.length = 0

      expect(this.tree.traverse(new ChromRegion('chr1: 51-200'), {
        breakOnFalse: true,
        dataFilter: this.strandFilter,
        dataCallback: this.earlyBreakTraverseCallback,
        notFirstCall: true
      })).to.be.true()
      expect(this.traverseContainer).to.eql(
        [6, 8].map(entry => this.expectedArray[entry])
      )
      this.traverseContainer.length = 0

      expect(this.tree.traverse(new ChromRegion('chr1: 50-200'), {
        breakOnFalse: true,
        dataFilter: this.strandAlwaysPassFilter,
        dataCallback: this.earlyBreakTraverseCallback
      }, ...this.additionalArgs)).to.be.false()
      expect(this.traverseContainer).to.eql(
        [2, 1].map(entry => this.expectedArrayWithArgs[entry])
      )
      this.traverseContainer.length = 0
    })

    it('Removing nodes from tree.', function () {
      this.tree.insert(this.dataArray.slice(), this.treeRange)
      this.tree.remove(new ChromRegion('chr1: 9-20'))
      expect(this.tree._root.childNum).to.equal(7)
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
