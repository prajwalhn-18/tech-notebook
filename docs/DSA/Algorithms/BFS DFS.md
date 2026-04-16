---
sidebar_position: 2
---

# BFS & DFS

---

# 1. FUNDAMENTALS

## 🔹 What are BFS and DFS?

**BFS (Breadth First Search)**

* Explore **level by level**
* Uses a **queue (FIFO)**
* Think: *wave expanding outward*

**DFS (Depth First Search)**

* Explore **as deep as possible first**
* Uses **recursion or stack (LIFO)**
* Think: *go deep, then backtrack*

---

## 🔹 Core Intuition

| Situation                   | Use |
| --------------------------- | --- |
| Shortest path (unweighted)  | BFS |
| Explore all possibilities   | DFS |
| Level-wise traversal        | BFS |
| Backtracking / combinations | DFS |

👉 Interview shortcut:

* “Minimum steps? → BFS”
* “Try all paths? → DFS”

---

## 🔹 Why Queue vs Stack?

* BFS → needs **level order → queue**
* DFS → needs **depth → stack/recursion**

---

## 🔹 Complexity

### Trees

* Time: **O(n)**
* Space:

  * BFS → O(width)
  * DFS → O(height)

### Graphs

* Time: **O(V + E)**
* Space:

  * BFS/DFS → O(V)

---

# 2. TREES

## 🔹 BFS (Level Order)

```js
function levelOrder(root) {
    if (!root) return [];

    const result = [];
    const queue = [root];

    while (queue.length) {
        const size = queue.length;
        const level = [];

        for (let i = 0; i < size; i++) {
            const node = queue.shift();
            level.push(node.val);

            if (node.left) queue.push(node.left);
            if (node.right) queue.push(node.right);
        }

        result.push(level);
    }

    return result;
}
```

👉 Used in:

* Level order traversal
* Minimum depth
* Zigzag traversal

---

## 🔹 DFS Traversals

### Preorder (Root → Left → Right)

```js
function preorder(root) {
    if (!root) return;
    console.log(root.val);
    preorder(root.left);
    preorder(root.right);
}
```

### Inorder (Left → Root → Right)

```js
function inorder(root) {
    if (!root) return;
    inorder(root.left);
    console.log(root.val);
    inorder(root.right);
}
```

👉 Used in:

* BST → gives **sorted order**

### Postorder (Left → Right → Root)

```js
function postorder(root) {
    if (!root) return;
    postorder(root.left);
    postorder(root.right);
    console.log(root.val);
}
```

👉 Used in:

* Delete tree
* Bottom-up problems

---

## 🔹 Iterative DFS

```js
function dfsIterative(root) {
    if (!root) return;

    const stack = [root];

    while (stack.length) {
        const node = stack.pop();
        console.log(node.val);

        if (node.right) stack.push(node.right);
        if (node.left) stack.push(node.left);
    }
}
```

---

# 3. GRAPHS

## 🔹 BFS (Traversal)

```js
function bfs(graph, start) {
    const queue = [start];
    const visited = new Set([start]);

    while (queue.length) {
        const node = queue.shift();
        console.log(node);

        for (const neighbor of graph[node]) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }
}
```

---

## 🔥 Shortest Path (Unweighted)

```js
function shortestPath(graph, start, target) {
    const queue = [[start, 0]];
    const visited = new Set([start]);

    while (queue.length) {
        const [node, dist] = queue.shift();

        if (node === target) return dist;

        for (const nei of graph[node]) {
            if (!visited.has(nei)) {
                visited.add(nei);
                queue.push([nei, dist + 1]);
            }
        }
    }

    return -1;
}
```

---

## 🔹 DFS (Graph)

```js
function dfs(graph, node, visited = new Set()) {
    if (visited.has(node)) return;

    visited.add(node);
    console.log(node);

    for (const nei of graph[node]) {
        dfs(graph, nei, visited);
    }
}
```

---

## 🔹 Cycle Detection (Undirected)

```js
function hasCycle(graph, node, visited = new Set(), parent = null) {
    visited.add(node);

    for (const nei of graph[node]) {
        if (!visited.has(nei)) {
            if (hasCycle(graph, nei, visited, node)) return true;
        } else if (nei !== parent) {
            return true;
        }
    }

    return false;
}
```

---

## 🔹 Connected Components

```js
function countComponents(graph) {
    const visited = new Set();
    let count = 0;

    for (const node in graph) {
        if (!visited.has(node)) {
            dfs(graph, node, visited);
            count++;
        }
    }

    return count;
}
```

---

# 4. PATTERNS

## 🔥 Matrix Problems

* Number of Islands → DFS/BFS
* Flood Fill → DFS/BFS

👉 Grid = Graph

---

## 🔥 Shortest Path → BFS

* Word Ladder
* Binary Matrix shortest path

---

## 🔥 Backtracking → DFS

* Permutations
* Subsets
* N-Queens

---

## 🔥 Topological Sort

* BFS (Kahn’s Algorithm)
* DFS (stack-based)

---

## 🔥 Cycle Detection

* DFS + visited states

---

## 🔥 Tree → Graph Shift

* Use when parent traversal needed

---

# 5. INTERVIEW THINKING

## 🔥 How to Decide BFS vs DFS

| Question Type   | Approach |
| --------------- | -------- |
| Minimum steps   | BFS      |
| All paths       | DFS      |
| Tree traversal  | DFS      |
| Level-wise      | BFS      |
| Graph traversal | Both     |

---

## 🔥 Common Mistakes

* Forgetting visited
* Infinite loops
* Using DFS for shortest path
* Not handling disconnected graphs

---

## 🔥 Tradeoffs

| BFS              | DFS               |
| ---------------- | ----------------- |
| More memory      | Less memory       |
| Finds shortest   | Doesn’t guarantee |
| Slower sometimes | Faster sometimes  |

---

## Follow-up Questions (Complete Guide)

## 1. What if the graph is huge?

When graphs are extremely large (millions/billions of nodes), standard BFS/DFS can break due to **memory and time constraints**.

### Problems:

* BFS → queue can explode (O(V))
* DFS → recursion stack overflow
* Graph may not fit in memory

### Solutions:

#### ✅ Use **Adjacency List + Streaming**

* Don’t load full graph
* Load neighbors on demand (lazy loading)

#### ✅ Use **Iterative DFS instead of recursive**

* Avoid stack overflow

#### ✅ Use **External Memory / Disk-based processing**

* Used in real systems (Google-scale graphs)

#### ✅ Use **Graph Partitioning**

* Divide graph into chunks
* Process separately

#### ✅ Use **Approximate Algorithms**

* Sampling, heuristics instead of full traversal

---

## 2. How to optimize BFS space?

BFS space complexity = **O(width of graph)** (can be huge)

### Optimizations:

#### ✅ Avoid storing full paths

Store only:

```js
visited[node] = parent
```

#### ✅ Use Bitsets instead of HashSet

```js
let visited = new Uint8Array(n)
```

#### ✅ Early stopping

Stop BFS as soon as target is found

#### ✅ Level-by-level cleanup

If you only need shortest path length:

* Don’t store all levels
* Track current level only

#### ✅ Bidirectional BFS (very powerful)

Reduces space from:

```
O(b^d) → O(b^(d/2))
```

---

## 3. Can DFS find shortest path?

### ❌ In general → NO

DFS does NOT guarantee shortest path because:

* It goes deep first
* Doesn’t explore level-by-level

### Example:

```
A → B → C → D (long path)
A → E (short path)
```

DFS may go through B first → wrong answer

---

### ✅ When DFS CAN find shortest path:

#### 1. Tree (no cycles)

* Only one path exists

#### 2. DAG (Directed Acyclic Graph)

* Use **Topological Sort + DP**

#### 3. Backtracking with pruning

* Try all paths but inefficient (exponential)

---

## 4. What about weighted graphs?

### Key rule:

| Graph Type                | Algorithm    |
| ------------------------- | ------------ |
| Unweighted                | BFS          |
| Weighted (non-negative)   | Dijkstra     |
| Weighted (negative edges) | Bellman-Ford |

---

### ❌ BFS fails for weighted graphs

Example:

```
A → B (cost 1)
A → C (cost 10)
B → C (cost 1)
```

BFS picks A → C (wrong)
Correct: A → B → C

---

### ✅ Use Dijkstra (JS Implementation)

```js
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(node) {
    this.heap.push(node);
    this.bubbleUp();
  }

  pop() {
    if (this.heap.length === 1) return this.heap.pop();
    const top = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.bubbleDown();
    return top;
  }

  bubbleUp() {
    let i = this.heap.length - 1;
    while (i > 0) {
      let p = Math.floor((i - 1) / 2);
      if (this.heap[p][1] <= this.heap[i][1]) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  bubbleDown() {
    let i = 0;
    while (true) {
      let left = 2 * i + 1;
      let right = 2 * i + 2;
      let smallest = i;

      if (left < this.heap.length && this.heap[left][1] < this.heap[smallest][1]) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right][1] < this.heap[smallest][1]) {
        smallest = right;
      }
      if (smallest === i) break;

      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }

  isEmpty() {
    return this.heap.length === 0;
  }
}

function dijkstra(graph, start) {
  let dist = {};
  let pq = new MinHeap();

  for (let node in graph) dist[node] = Infinity;
  dist[start] = 0;

  pq.push([start, 0]);

  while (!pq.isEmpty()) {
    let [node, d] = pq.pop();

    if (d > dist[node]) continue;

    for (let [nei, weight] of graph[node]) {
      let newDist = d + weight;
      if (newDist < dist[nei]) {
        dist[nei] = newDist;
        pq.push([nei, newDist]);
      }
    }
  }

  return dist;
}
```

---

## 5. Cycle detection in directed graph

### ✅ Use DFS with 3 states:

| State | Meaning                       |
| ----- | ----------------------------- |
| 0     | Unvisited                     |
| 1     | Visiting (in recursion stack) |
| 2     | Visited                       |

---

### JS Implementation:

```js
function hasCycle(graph) {
  let state = {};

  for (let node in graph) state[node] = 0;

  function dfs(node) {
    if (state[node] === 1) return true; // cycle
    if (state[node] === 2) return false;

    state[node] = 1;

    for (let nei of graph[node]) {
      if (dfs(nei)) return true;
    }

    state[node] = 2;
    return false;
  }

  for (let node in graph) {
    if (dfs(node)) return true;
  }

  return false;
}
```

---

## 6. Convert recursive DFS → iterative DFS

### Recursive:

```js
function dfs(node) {
  for (let nei of graph[node]) {
    dfs(nei);
  }
}
```

---

### Iterative:

```js
function dfsIterative(start, graph) {
  let stack = [start];
  let visited = new Set();

  while (stack.length) {
    let node = stack.pop();

    if (visited.has(node)) continue;
    visited.add(node);

    for (let nei of graph[node]) {
      stack.push(nei);
    }
  }
}
```

---

### Key Insight:

* Stack simulates recursion
* LIFO → same behavior as DFS

---

## 7. Multi-source BFS

### Idea:

Instead of 1 source → start BFS from **multiple sources simultaneously**

---

### Use cases:

* Rotting oranges
* Walls & Gates
* Distance to nearest 0
* Fire spread simulation

---

### JS Implementation:

```js
function multiSourceBFS(grid, sources) {
  let queue = [];
  let visited = new Set();

  for (let src of sources) {
    queue.push(src);
    visited.add(src.toString());
  }

  let steps = 0;

  while (queue.length) {
    let size = queue.length;

    while (size--) {
      let [x, y] = queue.shift();

      for (let [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        let nx = x + dx;
        let ny = y + dy;

        let key = `${nx},${ny}`;

        if (!visited.has(key)) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }

    steps++;
  }

  return steps;
}
```

---

## 8. Bidirectional BFS

### Idea:

Run BFS from:

* Source
* Target

Stop when they meet

---

### Why it's powerful:

Normal BFS:

```
O(b^d)
```

Bidirectional BFS:

```
O(b^(d/2))
```

Massive improvement.

---

### JS Implementation:

```js
function bidirectionalBFS(begin, end, graph) {
  let beginSet = new Set([begin]);
  let endSet = new Set([end]);
  let visited = new Set();

  let steps = 0;

  while (beginSet.size && endSet.size) {
    // Always expand smaller side
    if (beginSet.size > endSet.size) {
      [beginSet, endSet] = [endSet, beginSet];
    }

    let next = new Set();

    for (let node of beginSet) {
      if (endSet.has(node)) return steps;

      visited.add(node);

      for (let nei of graph[node]) {
        if (!visited.has(nei)) {
          next.add(nei);
        }
      }
    }

    beginSet = next;
    steps++;
  }

  return -1;
}
```
---

# 7. PRACTICE PROBLEMS

## 🟢 Easy

* Binary Tree Level Order Traversal → BFS
* Maximum Depth → DFS
* Flood Fill → DFS/BFS

## 🟡 Medium

* Number of Islands → DFS/BFS
* Course Schedule → Cycle detection
* Clone Graph → BFS/DFS
* Rotting Oranges → BFS

## 🔴 Hard

* Word Ladder → BFS
* Alien Dictionary → Topo sort
* Shortest Path in Binary Matrix → BFS
* Critical Connections → DFS

---

# 🔥 FINAL MENTAL MODEL

When you see a problem:

1. Is it graph/tree?
2. Need shortest path? → BFS
3. Need all possibilities? → DFS
4. Need levels? → BFS
5. Need recursion/backtracking? → DFS

---

**Goal:**
Be able to instantly decide:

* BFS or DFS
* Why
* Optimal implementation
