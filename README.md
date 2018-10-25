# give-tree <!-- omit in toc -->
Node implementation of interval-tree based cache data structures: GIVE Oak Tree and GIVE Pine Tree

- [Install](#install)
- [Usage](#usage)

# Install
```bash
npm install @givengine/give-tree
```

# Usage
You may import the entire namespace of `GiveTree`, which includes `GiveTree`, `GiveTreeNode`, `GiveNonLeafNode`, `DataNode` and `WitheringMixin`:
```javascript
// Import namespace
const GiveTreeNS = require('@givengine/chrom-region')

// Extend your own tree and/or nodes
class MyOwnTree extends GiveTreeNS.GiveTree {
  // Extension code here
}

class MyOwnNode extends GiveTreeNS.WitheringMixin(GiveTreeNS.GiveTreeNode) {
  // Extension code here
}
```

Or you may selectively import part of the module:
```javascript
// Import tree definition only
const GiveTree = require('@givengine/chrom-region').GiveTree

// Extend your own tree and/or nodes
class MyOwnTree extends GiveTree {
  // Extension code here
}
```


