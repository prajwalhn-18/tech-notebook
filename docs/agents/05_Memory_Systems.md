---
sidebar_position: 5
---

# Memory Systems for AI Agents

Memory systems enable agents to maintain context, learn from experience, and improve performance over time. This is one of the most critical components for building effective agents.

## Types of Memory

```
┌─────────────────────────────────────────┐
│         Agent Memory Architecture        │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────┐     │
│  │   Short-Term (Working) Memory │     │
│  │   Current conversation/task    │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌───────────────────────────────┐     │
│  │   Long-Term (Semantic) Memory │     │
│  │   Facts, knowledge, context    │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌───────────────────────────────┐     │
│  │   Episodic Memory             │     │
│  │   Past experiences, events     │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌───────────────────────────────┐     │
│  │   Procedural Memory           │     │
│  │   How to perform tasks         │     │
│  └───────────────────────────────┘     │
│                                         │
└─────────────────────────────────────────┘
```

## 1. Short-Term (Working) Memory

Holds information for the current task or conversation session.

### Implementation

```python
from collections import deque
from typing import List, Dict

class ShortTermMemory:
    """Manages conversation history within context window"""

    def __init__(self, max_tokens: int = 4000):
        self.messages: deque = deque()
        self.max_tokens = max_tokens
        self.current_tokens = 0

    def add_message(self, role: str, content: str, metadata: dict = None):
        """Add a message to working memory"""
        token_count = self._estimate_tokens(content)

        message = {
            'role': role,
            'content': content,
            'timestamp': time.time(),
            'tokens': token_count,
            'metadata': metadata or {}
        }

        self.messages.append(message)
        self.current_tokens += token_count

        # Trim if needed
        self._trim_to_fit()

    def get_context(self, max_messages: int = None) -> List[Dict]:
        """Retrieve messages for LLM context"""
        if max_messages:
            return list(self.messages)[-max_messages:]
        return list(self.messages)

    def _trim_to_fit(self):
        """Remove oldest messages if over token limit"""
        while self.current_tokens > self.max_tokens and len(self.messages) > 1:
            removed = self.messages.popleft()
            self.current_tokens -= removed['tokens']

    def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation (4 chars ≈ 1 token)"""
        return len(text) // 4

    def summarize_old_messages(self, llm) -> str:
        """Create summary of old messages before discarding"""
        if len(self.messages) < 5:
            return ""

        # Get first half of messages
        to_summarize = list(self.messages)[:len(self.messages)//2]

        prompt = f"""
Summarize the key points from this conversation history:

{self._format_messages(to_summarize)}

Provide a concise summary of:
1. Main topics discussed
2. Important decisions made
3. Key information that should be remembered
"""

        summary = llm.generate(prompt)
        return summary

    def clear(self):
        """Clear all messages"""
        self.messages.clear()
        self.current_tokens = 0
```

### Advanced: Sliding Window with Summarization

```python
class SlidingWindowMemory(ShortTermMemory):
    """
    Maintains recent messages in full,
    older messages as summaries
    """

    def __init__(self, max_tokens: int = 4000, summary_threshold: int = 10):
        super().__init__(max_tokens)
        self.summary_threshold = summary_threshold
        self.summaries = []

    def add_message(self, role: str, content: str, metadata: dict = None):
        super().add_message(role, content, metadata)

        # Check if we should summarize old messages
        if len(self.messages) > self.summary_threshold:
            self._create_summary()

    def _create_summary(self):
        """Summarize oldest messages and remove them"""
        # Take oldest messages
        to_summarize = []
        while len(self.messages) > self.summary_threshold // 2:
            to_summarize.append(self.messages.popleft())

        # Create summary
        summary_text = self._generate_summary(to_summarize)

        self.summaries.append({
            'summary': summary_text,
            'message_count': len(to_summarize),
            'timestamp': time.time()
        })

    def get_full_context(self) -> str:
        """Get both summaries and recent messages"""
        context_parts = []

        # Add summaries
        if self.summaries:
            context_parts.append("=== Earlier Conversation Summary ===")
            for summary in self.summaries:
                context_parts.append(summary['summary'])

        # Add recent messages
        context_parts.append("\n=== Recent Messages ===")
        for msg in self.messages:
            context_parts.append(f"{msg['role']}: {msg['content']}")

        return "\n".join(context_parts)
```

## 2. Long-Term (Semantic) Memory

Stores facts, knowledge, and context that persists across sessions.

### Vector-Based Implementation

```python
import numpy as np
from typing import List, Tuple
import chromadb

class LongTermMemory:
    """Persistent semantic memory using vector database"""

    def __init__(self, collection_name: str = "agent_memory"):
        self.client = chromadb.Client()
        self.collection = self.client.create_collection(collection_name)
        self.embedding_model = self._load_embedding_model()

    def store(
        self,
        content: str,
        metadata: dict = None,
        category: str = "general"
    ):
        """Store information in long-term memory"""

        # Generate embedding
        embedding = self._get_embedding(content)

        # Store in vector DB
        self.collection.add(
            embeddings=[embedding],
            documents=[content],
            metadatas=[{
                'category': category,
                'timestamp': time.time(),
                **(metadata or {})
            }],
            ids=[self._generate_id()]
        )

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        filter_category: str = None
    ) -> List[Dict]:
        """Retrieve relevant memories"""

        # Generate query embedding
        query_embedding = self._get_embedding(query)

        # Build filter
        where_filter = None
        if filter_category:
            where_filter = {"category": filter_category}

        # Search
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_filter
        )

        # Format results
        memories = []
        for i in range(len(results['documents'][0])):
            memories.append({
                'content': results['documents'][0][i],
                'metadata': results['metadatas'][0][i],
                'relevance': results['distances'][0][i]
            })

        return memories

    def _get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text"""
        # Use OpenAI, Sentence Transformers, etc.
        return self.embedding_model.encode(text).tolist()

    def _generate_id(self) -> str:
        """Generate unique ID for memory"""
        import uuid
        return str(uuid.uuid4())

    def update(self, memory_id: str, new_content: str):
        """Update existing memory"""
        embedding = self._get_embedding(new_content)
        self.collection.update(
            ids=[memory_id],
            embeddings=[embedding],
            documents=[new_content]
        )

    def delete(self, memory_id: str):
        """Remove memory"""
        self.collection.delete(ids=[memory_id])
```

### Knowledge Graph Memory

```python
import networkx as nx

class KnowledgeGraphMemory:
    """
    Store memories as a knowledge graph
    for structured relationships
    """

    def __init__(self):
        self.graph = nx.DiGraph()

    def add_entity(self, entity: str, attributes: dict = None):
        """Add an entity to the graph"""
        self.graph.add_node(entity, **(attributes or {}))

    def add_relationship(
        self,
        subject: str,
        predicate: str,
        object: str,
        metadata: dict = None
    ):
        """Add a relationship between entities"""
        self.graph.add_edge(
            subject,
            object,
            relationship=predicate,
            **(metadata or {})
        )

    def query(self, query_type: str, **kwargs) -> List:
        """Query the knowledge graph"""

        if query_type == "neighbors":
            entity = kwargs['entity']
            return list(self.graph.neighbors(entity))

        elif query_type == "path":
            start = kwargs['start']
            end = kwargs['end']
            try:
                return nx.shortest_path(self.graph, start, end)
            except nx.NetworkXNoPath:
                return None

        elif query_type == "related":
            entity = kwargs['entity']
            depth = kwargs.get('depth', 2)
            return self._get_related_entities(entity, depth)

    def _get_related_entities(self, entity: str, depth: int) -> set:
        """Get all entities within N hops"""
        if entity not in self.graph:
            return set()

        related = set()
        current_level = {entity}

        for _ in range(depth):
            next_level = set()
            for node in current_level:
                neighbors = set(self.graph.neighbors(node))
                next_level.update(neighbors)
                related.update(neighbors)
            current_level = next_level

        return related

    def visualize(self, output_file: str = "knowledge_graph.png"):
        """Visualize the knowledge graph"""
        import matplotlib.pyplot as plt

        pos = nx.spring_layout(self.graph)
        nx.draw(
            self.graph,
            pos,
            with_labels=True,
            node_color='lightblue',
            node_size=1500,
            font_size=10,
            arrows=True
        )
        plt.savefig(output_file)
```

## 3. Episodic Memory

Stores specific experiences and events.

### Implementation

```python
from datetime import datetime
from typing import Optional

class EpisodicMemory:
    """
    Stores specific episodes/experiences
    """

    def __init__(self, db_path: str = "episodes.db"):
        self.episodes = []
        self.db_path = db_path

    def record_episode(
        self,
        context: str,
        action: str,
        result: str,
        success: bool,
        metadata: dict = None
    ):
        """Record a new episode"""

        episode = {
            'id': self._generate_id(),
            'timestamp': datetime.now(),
            'context': context,
            'action': action,
            'result': result,
            'success': success,
            'metadata': metadata or {},
            'tags': self._extract_tags(context, action)
        }

        self.episodes.append(episode)
        self._persist_episode(episode)

    def find_similar_episodes(
        self,
        current_context: str,
        top_k: int = 5
    ) -> List[Dict]:
        """Find episodes similar to current situation"""

        # Compute similarity scores
        scored_episodes = []
        for episode in self.episodes:
            similarity = self._compute_similarity(
                current_context,
                episode['context']
            )
            scored_episodes.append((similarity, episode))

        # Sort and return top K
        scored_episodes.sort(reverse=True, key=lambda x: x[0])
        return [ep for _, ep in scored_episodes[:top_k]]

    def get_successful_patterns(self, min_count: int = 3) -> List[Dict]:
        """Identify successful action patterns"""

        # Group episodes by context similarity
        patterns = {}

        for episode in self.episodes:
            if not episode['success']:
                continue

            # Find pattern key
            pattern_key = self._get_pattern_key(episode)

            if pattern_key not in patterns:
                patterns[pattern_key] = {
                    'contexts': [],
                    'actions': [],
                    'count': 0
                }

            patterns[pattern_key]['contexts'].append(episode['context'])
            patterns[pattern_key]['actions'].append(episode['action'])
            patterns[pattern_key]['count'] += 1

        # Filter by minimum count
        return [
            p for p in patterns.values()
            if p['count'] >= min_count
        ]

    def _compute_similarity(self, text1: str, text2: str) -> float:
        """Compute text similarity"""
        # Use embeddings, TF-IDF, or simple overlap
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())

        intersection = words1 & words2
        union = words1 | words2

        return len(intersection) / len(union) if union else 0
```

### Learning from Episodes

```python
class ReinforcedEpisodicMemory(EpisodicMemory):
    """
    Episodic memory with reinforcement learning
    """

    def __init__(self):
        super().__init__()
        self.action_values = {}  # Q-values for state-action pairs

    def record_episode(
        self,
        context: str,
        action: str,
        result: str,
        success: bool,
        reward: float = None,
        metadata: dict = None
    ):
        """Record episode and update Q-values"""

        # Record episode
        super().record_episode(context, action, result, success, metadata)

        # Update Q-values if reward provided
        if reward is not None:
            state_key = self._hash_context(context)
            action_key = f"{state_key}:{action}"

            # Q-learning update
            alpha = 0.1  # Learning rate
            current_q = self.action_values.get(action_key, 0.0)
            new_q = current_q + alpha * (reward - current_q)

            self.action_values[action_key] = new_q

    def suggest_action(self, context: str, available_actions: List[str]) -> str:
        """Suggest best action based on experience"""

        state_key = self._hash_context(context)

        # Get Q-values for available actions
        action_values = {}
        for action in available_actions:
            action_key = f"{state_key}:{action}"
            action_values[action] = self.action_values.get(action_key, 0.0)

        # Return action with highest value
        return max(action_values.items(), key=lambda x: x[1])[0]
```

## 4. Procedural Memory

Stores how to perform tasks and procedures.

```python
class ProceduralMemory:
    """
    Stores learned procedures and skills
    """

    def __init__(self):
        self.procedures = {}

    def store_procedure(
        self,
        name: str,
        steps: List[str],
        conditions: dict = None,
        success_rate: float = 0.0
    ):
        """Store a procedure"""

        self.procedures[name] = {
            'steps': steps,
            'conditions': conditions or {},
            'success_rate': success_rate,
            'usage_count': 0,
            'last_used': None
        }

    def get_procedure(self, name: str) -> Optional[Dict]:
        """Retrieve a procedure"""
        return self.procedures.get(name)

    def update_success_rate(self, name: str, success: bool):
        """Update procedure based on execution outcome"""

        if name not in self.procedures:
            return

        proc = self.procedures[name]

        # Running average of success rate
        n = proc['usage_count']
        current_rate = proc['success_rate']

        new_rate = (current_rate * n + (1.0 if success else 0.0)) / (n + 1)

        proc['success_rate'] = new_rate
        proc['usage_count'] += 1
        proc['last_used'] = datetime.now()

    def find_applicable_procedures(self, context: dict) -> List[str]:
        """Find procedures that match current context"""

        applicable = []

        for name, proc in self.procedures.items():
            conditions = proc['conditions']

            # Check if all conditions are met
            if self._conditions_met(conditions, context):
                applicable.append(name)

        # Sort by success rate
        applicable.sort(
            key=lambda x: self.procedures[x]['success_rate'],
            reverse=True
        )

        return applicable

    def _conditions_met(self, conditions: dict, context: dict) -> bool:
        """Check if conditions match context"""
        for key, value in conditions.items():
            if context.get(key) != value:
                return False
        return True
```

## Integrated Memory System

Combining all memory types:

```python
class IntegratedMemorySystem:
    """
    Unified memory system combining all types
    """

    def __init__(self):
        self.short_term = ShortTermMemory()
        self.long_term = LongTermMemory()
        self.episodic = ReinforcedEpisodicMemory()
        self.procedural = ProceduralMemory()
        self.knowledge_graph = KnowledgeGraphMemory()

    def remember(
        self,
        content: str,
        memory_type: str = "auto",
        **kwargs
    ):
        """Store in appropriate memory system"""

        if memory_type == "auto":
            memory_type = self._classify_memory(content)

        if memory_type == "short_term":
            self.short_term.add_message(**kwargs)
        elif memory_type == "long_term":
            self.long_term.store(content, **kwargs)
        elif memory_type == "episodic":
            self.episodic.record_episode(**kwargs)
        elif memory_type == "procedural":
            self.procedural.store_procedure(**kwargs)

    def recall(
        self,
        query: str,
        memory_types: List[str] = None
    ) -> Dict:
        """Retrieve from multiple memory systems"""

        if memory_types is None:
            memory_types = ["short_term", "long_term", "episodic"]

        results = {}

        if "short_term" in memory_types:
            results['recent_context'] = self.short_term.get_context()

        if "long_term" in memory_types:
            results['relevant_facts'] = self.long_term.retrieve(query)

        if "episodic" in memory_types:
            results['similar_experiences'] = \
                self.episodic.find_similar_episodes(query)

        if "procedural" in memory_types:
            # Extract context for procedure matching
            context = self._extract_context(query)
            results['applicable_procedures'] = \
                self.procedural.find_applicable_procedures(context)

        return results

    def consolidate(self):
        """
        Move important short-term memories to long-term
        (Similar to sleep consolidation in humans)
        """

        # Get recent messages
        recent = self.short_term.get_context()

        # Identify important information
        important = self._identify_important_memories(recent)

        # Move to long-term
        for memory in important:
            self.long_term.store(
                memory['content'],
                metadata={'source': 'consolidation'}
            )
```

## Memory Best Practices

### 1. Memory Pruning

```python
def prune_memories(memory_system, threshold_days=90):
    """Remove old, unused memories"""
    cutoff = datetime.now() - timedelta(days=threshold_days)

    # Remove based on age and relevance
    for memory_id in memory_system.get_all_ids():
        memory = memory_system.get(memory_id)

        if (memory['timestamp'] < cutoff and
            memory['access_count'] < 5):
            memory_system.delete(memory_id)
```

### 2. Memory Indexing

```python
# Create indices for fast retrieval
memory_system.create_index('category')
memory_system.create_index('timestamp')
memory_system.create_index('tags')
```

### 3. Privacy and Security

```python
class SecureMemory(LongTermMemory):
    """Memory system with encryption and access control"""

    def store(self, content: str, sensitivity: str = "normal", **kwargs):
        # Encrypt sensitive content
        if sensitivity in ["high", "pii"]:
            content = self._encrypt(content)

        # Add access control metadata
        kwargs['sensitivity'] = sensitivity
        kwargs['requires_auth'] = sensitivity == "high"

        super().store(content, **kwargs)
```

## Next Steps

- Learn about **prompt engineering** for effective memory usage
- Explore **evaluation methods** for memory systems
- Study **multi-agent systems** with shared memory
- Understand **scaling strategies** for large memory stores
