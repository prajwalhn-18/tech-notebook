---
sidebar_position: 2
---

# Core Components of an AI Agent

## Architecture Overview

Every AI agent consists of several fundamental components that work together:

```
┌─────────────────────────────────────────┐
│           Agent Controller              │
│  (Orchestration & Decision Making)      │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Memory  │  │  Tools  │  │  LLM    │
│ System  │  │ Executor│  │ Backend │
└─────────┘  └─────────┘  └─────────┘
```

## 1. Language Model (LLM) Backend

The brain of the agent that provides reasoning capabilities.

### Key Responsibilities
- Understand user intent
- Generate reasoning chains
- Decide which tools to use
- Produce natural language responses

### Important Considerations

```python
class LLMBackend:
    def __init__(self, model_name, temperature=0.7):
        self.model = model_name
        self.temperature = temperature  # Controls randomness

    def generate(self, prompt, max_tokens=1000):
        """Generate completion from the model"""
        pass
```

**Temperature Settings:**
- **Low (0.0-0.3)**: Deterministic, focused (good for tool selection)
- **Medium (0.4-0.7)**: Balanced (good for general reasoning)
- **High (0.8-1.0)**: Creative, diverse (good for brainstorming)

**Model Selection:**
- **GPT-4/Claude Opus**: Complex reasoning, expensive
- **GPT-3.5/Claude Sonnet**: Good balance of cost and capability
- **Smaller models**: Fast, cheap, limited reasoning

## 2. Tool System

Enables the agent to interact with external systems.

### Tool Definition

```python
from typing import Callable, Dict, Any

class Tool:
    def __init__(
        self,
        name: str,
        description: str,
        function: Callable,
        parameters: Dict[str, Any]
    ):
        self.name = name
        self.description = description
        self.function = function
        self.parameters = parameters

    def execute(self, **kwargs):
        """Execute the tool with given parameters"""
        return self.function(**kwargs)
```

### Example Tools

```python
# Calculator Tool
def calculator(expression: str) -> float:
    """
    Evaluates a mathematical expression safely.
    Args:
        expression: A mathematical expression string (e.g., "2 + 2 * 3")
    Returns:
        The result of the calculation
    """
    import ast
    import operator

    # Safe evaluation without exec/eval
    ops = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
    }
    # Implementation...
    return result

# Web Search Tool
def web_search(query: str, num_results: int = 5) -> list:
    """
    Search the web for information.
    Args:
        query: Search query string
        num_results: Number of results to return
    Returns:
        List of search results with title, snippet, and URL
    """
    # Implementation using search API
    pass

# Database Query Tool
def query_database(sql: str) -> list:
    """
    Execute a read-only SQL query.
    Args:
        sql: SELECT query to execute
    Returns:
        Query results as list of dictionaries
    """
    # Implementation with safety checks
    pass
```

### Tool Registry

```python
class ToolRegistry:
    def __init__(self):
        self.tools: Dict[str, Tool] = {}

    def register(self, tool: Tool):
        """Register a new tool"""
        self.tools[tool.name] = tool

    def get_tool(self, name: str) -> Tool:
        """Retrieve a tool by name"""
        return self.tools.get(name)

    def get_tool_descriptions(self) -> str:
        """Get formatted descriptions for LLM prompt"""
        descriptions = []
        for tool in self.tools.values():
            descriptions.append(
                f"- {tool.name}: {tool.description}\n"
                f"  Parameters: {tool.parameters}"
            )
        return "\n".join(descriptions)
```

## 3. Memory System

Enables agents to maintain context and learn from interactions.

### Types of Memory

#### Short-Term Memory (Working Memory)
Holds information for the current task/conversation.

```python
class ShortTermMemory:
    def __init__(self, max_tokens=4000):
        self.messages = []
        self.max_tokens = max_tokens

    def add_message(self, role: str, content: str):
        """Add a message to short-term memory"""
        self.messages.append({"role": role, "content": content})
        self._trim_if_needed()

    def get_context(self) -> list:
        """Get all messages in context window"""
        return self.messages

    def _trim_if_needed(self):
        """Remove old messages if token limit exceeded"""
        while self._count_tokens() > self.max_tokens:
            self.messages.pop(0)
```

#### Long-Term Memory (Persistent Storage)
Stores information across sessions.

```python
class LongTermMemory:
    def __init__(self, vector_db):
        self.vector_db = vector_db

    def store(self, content: str, metadata: dict):
        """Store information with embeddings"""
        embedding = self._get_embedding(content)
        self.vector_db.insert(embedding, content, metadata)

    def retrieve(self, query: str, top_k=5) -> list:
        """Retrieve relevant memories based on query"""
        query_embedding = self._get_embedding(query)
        return self.vector_db.search(query_embedding, top_k)

    def _get_embedding(self, text: str):
        """Convert text to vector embedding"""
        # Use embedding model (OpenAI, Sentence Transformers, etc.)
        pass
```

#### Episodic Memory
Stores specific experiences and events.

```python
class EpisodicMemory:
    def __init__(self):
        self.episodes = []

    def add_episode(self, state, action, result, timestamp):
        """Record an episode"""
        self.episodes.append({
            "state": state,
            "action": action,
            "result": result,
            "timestamp": timestamp
        })

    def get_similar_episodes(self, current_state) -> list:
        """Find similar past experiences"""
        # Compare current state to past states
        pass
```

## 4. Planning & Reasoning Module

Breaks down complex tasks and decides action sequences.

### Task Decomposition

```python
class Planner:
    def __init__(self, llm):
        self.llm = llm

    def create_plan(self, goal: str) -> list:
        """Break down goal into subtasks"""
        prompt = f"""
        Break down the following goal into specific, actionable steps:
        Goal: {goal}

        Provide a numbered list of steps.
        """
        response = self.llm.generate(prompt)
        return self._parse_steps(response)

    def _parse_steps(self, response: str) -> list:
        """Extract steps from LLM response"""
        # Parse numbered list
        pass
```

### Decision Making

```python
class DecisionMaker:
    def select_action(
        self,
        current_state: dict,
        available_actions: list,
        goal: str
    ) -> str:
        """Choose best action given current state"""

        # Evaluate each action
        scores = []
        for action in available_actions:
            score = self._evaluate_action(action, current_state, goal)
            scores.append((action, score))

        # Select highest scoring action
        best_action = max(scores, key=lambda x: x[1])[0]
        return best_action

    def _evaluate_action(self, action, state, goal) -> float:
        """Score how well action advances toward goal"""
        # Use heuristics or LLM evaluation
        pass
```

## 5. Observation & Perception

Processes inputs from the environment.

```python
class Observer:
    def __init__(self):
        self.sensors = []

    def observe(self) -> dict:
        """Gather current state information"""
        observations = {}

        # Collect from various sources
        observations['user_input'] = self._get_user_input()
        observations['tool_results'] = self._get_tool_results()
        observations['system_state'] = self._get_system_state()

        return observations

    def _get_user_input(self):
        """Process user messages"""
        pass

    def _get_tool_results(self):
        """Collect results from tool executions"""
        pass
```

## 6. Action Executor

Carries out actions determined by the agent.

```python
class ActionExecutor:
    def __init__(self, tool_registry: ToolRegistry):
        self.tools = tool_registry

    def execute(self, action: dict) -> dict:
        """Execute an action and return result"""
        action_type = action['type']

        if action_type == 'tool_use':
            return self._execute_tool(action)
        elif action_type == 'respond':
            return self._generate_response(action)
        else:
            raise ValueError(f"Unknown action type: {action_type}")

    def _execute_tool(self, action: dict) -> dict:
        """Execute a tool call"""
        tool_name = action['tool']
        parameters = action['parameters']

        tool = self.tools.get_tool(tool_name)
        result = tool.execute(**parameters)

        return {
            'success': True,
            'result': result
        }
```

## 7. Controller / Orchestrator

Coordinates all components and implements the agent loop.

```python
class AgentController:
    def __init__(
        self,
        llm,
        tools: ToolRegistry,
        memory: ShortTermMemory,
        planner: Planner
    ):
        self.llm = llm
        self.tools = tools
        self.memory = memory
        self.planner = planner
        self.executor = ActionExecutor(tools)

    def run(self, user_input: str, max_iterations=10):
        """Main agent loop"""
        self.memory.add_message("user", user_input)

        for i in range(max_iterations):
            # Observe current state
            context = self.memory.get_context()

            # Reason about next action
            action = self._decide_next_action(context)

            # Execute action
            result = self.executor.execute(action)

            # Update memory
            self.memory.add_message("assistant", str(result))

            # Check if task is complete
            if self._is_complete(result):
                break

        return self.memory.get_context()

    def _decide_next_action(self, context) -> dict:
        """Determine next action using LLM"""
        # Build prompt with context and available tools
        prompt = self._build_prompt(context)
        response = self.llm.generate(prompt)
        action = self._parse_action(response)
        return action
```

## Component Integration Example

```python
# Initialize components
llm = LLMBackend("gpt-4", temperature=0.7)
tools = ToolRegistry()
tools.register(Tool("calculator", "Perform calculations", calculator, {}))
tools.register(Tool("search", "Search the web", web_search, {}))

memory = ShortTermMemory(max_tokens=4000)
planner = Planner(llm)

# Create agent
agent = AgentController(llm, tools, memory, planner)

# Run agent
result = agent.run("What is the population of Tokyo and how much has it grown since 2000?")
```

## Best Practices

1. **Modularity**: Keep components loosely coupled for easier testing and maintenance
2. **Error Handling**: Each component should handle failures gracefully
3. **Logging**: Track all component interactions for debugging
4. **Security**: Validate tool inputs and sandbox execution
5. **Performance**: Cache results and optimize token usage
6. **Observability**: Monitor component performance and behavior

## Next Steps

- Study different **agent architectures** that combine these components
- Learn about **prompt engineering** for effective component communication
- Explore **memory strategies** for different use cases
- Understand **evaluation methods** for each component
