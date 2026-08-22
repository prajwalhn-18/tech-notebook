---
sidebar_position: 10
---

# Best Practices for Building AI Agents

A comprehensive guide to patterns, practices, and principles for building robust, efficient, and maintainable AI agents.

## Design Principles

### 1. Start Simple, Iterate

```python
# Phase 1: Simple single-step agent
class SimpleAgent:
    def run(self, task: str) -> str:
        return self.llm.generate(f"Task: {task}")

# Phase 2: Add tool use
class ToolAgent(SimpleAgent):
    def run(self, task: str) -> str:
        # Decide if tool needed
        # Use tool
        # Generate response
        pass

# Phase 3: Add multi-step reasoning
class ReActAgent(ToolAgent):
    # Full ReAct loop
    pass

# Phase 4: Add memory, planning, etc.
```

**Don't build everything at once.** Validate each capability before adding complexity.

### 2. Single Responsibility Principle

Each agent should have a clear, focused purpose.

```python
# Bad: Agent that does everything
class SuperAgent:
    def run(self, task):
        if "search" in task:
            return self.search()
        elif "analyze" in task:
            return self.analyze()
        elif "write" in task:
            return self.write()
        # ... many more

# Good: Specialized agents
class SearchAgent:
    """Specialized in information retrieval"""
    def run(self, query: str):
        return self.search(query)

class AnalysisAgent:
    """Specialized in data analysis"""
    def run(self, data: str):
        return self.analyze(data)

class WritingAgent:
    """Specialized in content creation"""
    def run(self, outline: str):
        return self.write(outline)
```

### 3. Clear Interfaces

Define clear contracts between components.

```python
from abc import ABC, abstractmethod
from typing import Protocol

class Tool(Protocol):
    """Standard tool interface"""

    name: str
    description: str

    def execute(self, **kwargs) -> dict:
        """Execute the tool with given parameters"""
        ...

class Memory(Protocol):
    """Standard memory interface"""

    def store(self, content: str, metadata: dict) -> None:
        """Store information"""
        ...

    def retrieve(self, query: str, top_k: int) -> list:
        """Retrieve relevant information"""
        ...

class Agent(ABC):
    """Standard agent interface"""

    @abstractmethod
    def run(self, task: str) -> dict:
        """Execute agent on task"""
        pass
```

## Prompt Engineering Best Practices

### 1. Structured Prompts

```python
STRUCTURED_PROMPT = """
[SYSTEM INSTRUCTIONS]
{system_instructions}

[AVAILABLE TOOLS]
{tool_descriptions}

[CONVERSATION HISTORY]
{conversation_history}

[CURRENT TASK]
{current_task}

[OUTPUT FORMAT]
{expected_format}

[BEGIN]
"""
```

### 2. Few-Shot Examples

```python
def build_few_shot_prompt(task: str, examples: List[dict]) -> str:
    """Include relevant examples"""

    prompt = "Here are examples of similar tasks:\n\n"

    for i, example in enumerate(examples, 1):
        prompt += f"Example {i}:\n"
        prompt += f"Task: {example['task']}\n"
        prompt += f"Approach: {example['approach']}\n"
        prompt += f"Result: {example['result']}\n\n"

    prompt += f"Now solve this task:\n{task}"

    return prompt
```

### 3. Clear Constraints

```python
CONSTRAINED_PROMPT = """
Task: {task}

Constraints:
- You MUST use at least one of the available tools
- You MUST NOT make assumptions about data you don't have
- You MUST stop after 5 steps if task is not complete
- You MUST cite sources for factual claims

Available tools: {tools}

Begin:
"""
```

## Error Handling Patterns

### 1. Graceful Degradation

```python
class RobustAgent:
    def run(self, task: str):
        """Agent with fallback strategies"""

        try:
            # Try primary approach
            return self._primary_approach(task)

        except ToolExecutionError as e:
            # Fallback: Try alternative tool
            logging.warning(f"Primary tool failed: {e}, trying alternative")
            return self._alternative_approach(task)

        except TimeoutError:
            # Fallback: Return partial result
            logging.warning("Task timeout, returning partial result")
            return self._get_partial_result()

        except Exception as e:
            # Last resort: Graceful error message
            logging.error(f"Agent failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'partial_work': self._get_partial_work()
            }
```

### 2. Retry with Backoff

```python
def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    base_delay: float = 1.0
):
    """Retry with exponential backoff"""

    for attempt in range(max_retries):
        try:
            return func()

        except RetryableError as e:
            if attempt == max_retries - 1:
                raise

            delay = base_delay * (2 ** attempt)
            logging.warning(f"Attempt {attempt+1} failed, retrying in {delay}s")
            time.sleep(delay)

        except NonRetryableError:
            # Don't retry on certain errors
            raise
```

### 3. Validation at Boundaries

```python
class ValidatingAgent:
    """Validate inputs and outputs"""

    def run(self, task: str) -> dict:
        # Validate input
        if not self._validate_input(task):
            raise ValueError("Invalid task input")

        # Execute
        result = self._execute(task)

        # Validate output
        if not self._validate_output(result):
            # Try to fix or re-execute
            result = self._fix_output(result)

        return result

    def _validate_input(self, task: str) -> bool:
        """Validate task input"""
        return (
            task and
            len(task) > 0 and
            len(task) < MAX_TASK_LENGTH and
            not self._contains_malicious_content(task)
        )

    def _validate_output(self, result: dict) -> bool:
        """Validate result structure and content"""
        required_keys = ['success', 'result']
        return (
            all(key in result for key in required_keys) and
            self._is_reasonable_result(result)
        )
```

## Performance Optimization

### 1. Caching

```python
from functools import lru_cache
import hashlib

class CachingAgent:
    """Agent with result caching"""

    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools
        self.cache = {}

    def run(self, task: str) -> dict:
        """Execute with caching"""

        # Check cache
        cache_key = self._get_cache_key(task)
        if cache_key in self.cache:
            logging.info("Cache hit")
            return self.cache[cache_key]

        # Execute
        result = self._execute(task)

        # Store in cache
        self.cache[cache_key] = result

        return result

    def _get_cache_key(self, task: str) -> str:
        """Generate cache key"""
        return hashlib.md5(task.encode()).hexdigest()

    @lru_cache(maxsize=100)
    def _call_llm(self, prompt: str) -> str:
        """Cached LLM calls for identical prompts"""
        return self.llm.generate(prompt)
```

### 2. Parallel Execution

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class ParallelAgent:
    """Execute independent tasks in parallel"""

    def __init__(self, max_workers: int = 5):
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

    async def run_parallel(self, tasks: List[str]) -> List[dict]:
        """Execute multiple tasks in parallel"""

        # Create tasks
        coroutines = [self._run_async(task) for task in tasks]

        # Execute in parallel
        results = await asyncio.gather(*coroutines)

        return results

    async def _run_async(self, task: str) -> dict:
        """Async task execution"""
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor,
            self._execute,
            task
        )
        return result
```

### 3. Token Optimization

```python
class TokenOptimizedAgent:
    """Minimize token usage"""

    def optimize_prompt(self, prompt: str) -> str:
        """Reduce prompt tokens while preserving meaning"""

        # Remove redundant whitespace
        optimized = re.sub(r'\s+', ' ', prompt)

        # Use concise formatting
        optimized = self._use_compact_format(optimized)

        # Remove unnecessary examples if context is too long
        if self._count_tokens(optimized) > self.max_tokens:
            optimized = self._remove_examples(optimized)

        return optimized

    def summarize_long_context(self, context: str) -> str:
        """Summarize to reduce tokens"""

        if self._count_tokens(context) < self.max_context_tokens:
            return context

        # Use LLM to summarize
        summary = self.llm.generate(
            f"Summarize the key points in under 200 words:\n\n{context}"
        )

        return summary
```

## Testing Best Practices

### 1. Unit Tests for Components

```python
import pytest

class TestToolExecution:
    def test_calculator_basic(self):
        """Test calculator with simple expression"""
        tool = CalculatorTool()
        result = tool.execute(expression="2 + 2")
        assert result == 4

    def test_calculator_error_handling(self):
        """Test calculator handles invalid input"""
        tool = CalculatorTool()
        with pytest.raises(ValueError):
            tool.execute(expression="invalid")

    @pytest.mark.parametrize("expression,expected", [
        ("2 + 2", 4),
        ("10 / 2", 5),
        ("3 * 4", 12),
    ])
    def test_calculator_expressions(self, expression, expected):
        """Test various expressions"""
        tool = CalculatorTool()
        result = tool.execute(expression=expression)
        assert result == expected
```

### 2. Integration Tests

```python
class TestAgentIntegration:
    @pytest.fixture
    def agent(self):
        """Setup agent for testing"""
        llm = MockLLM()  # Use mock for deterministic tests
        tools = [CalculatorTool(), SearchTool()]
        return Agent(llm, tools)

    def test_simple_calculation_task(self, agent):
        """Test agent solves calculation task"""
        result = agent.run("What is 15 * 7?")

        assert result['success'] is True
        assert "105" in result['output']

    def test_multi_step_task(self, agent):
        """Test agent completes multi-step task"""
        task = "Search for population of Tokyo, then calculate 10% of it"
        result = agent.run(task)

        assert result['success'] is True
        assert len(result['steps']) >= 3  # Search + Calculate + Respond
```

### 3. Property-Based Testing

```python
from hypothesis import given, strategies as st

class TestAgentProperties:
    @given(st.text(min_size=1, max_size=100))
    def test_agent_handles_any_text_input(self, text):
        """Agent should handle any text input without crashing"""
        agent = Agent(llm, tools)

        try:
            result = agent.run(text)
            assert isinstance(result, dict)
            assert 'success' in result
        except Exception as e:
            # Should only raise known exception types
            assert isinstance(e, (ValueError, AgentError))
```

## Monitoring and Observability

### 1. Structured Logging

```python
import structlog

logger = structlog.get_logger()

class ObservableAgent:
    def run(self, task: str) -> dict:
        """Agent with comprehensive logging"""

        logger.info(
            "agent_task_started",
            task=task,
            agent_id=self.agent_id
        )

        try:
            result = self._execute(task)

            logger.info(
                "agent_task_completed",
                task=task,
                agent_id=self.agent_id,
                success=result['success'],
                steps=len(result['steps']),
                execution_time=result['execution_time']
            )

            return result

        except Exception as e:
            logger.error(
                "agent_task_failed",
                task=task,
                agent_id=self.agent_id,
                error=str(e),
                traceback=traceback.format_exc()
            )
            raise
```

### 2. Metrics Collection

```python
from prometheus_client import Counter, Histogram, Gauge

# Define metrics
task_counter = Counter(
    'agent_tasks_total',
    'Total number of tasks executed',
    ['agent_type', 'status']
)

task_duration = Histogram(
    'agent_task_duration_seconds',
    'Task execution duration',
    ['agent_type']
)

active_agents = Gauge(
    'agent_active_count',
    'Number of currently active agents'
)

class MetricsAgent:
    def run(self, task: str) -> dict:
        """Agent with metrics"""

        active_agents.inc()
        start_time = time.time()

        try:
            result = self._execute(task)

            # Record success
            task_counter.labels(
                agent_type=self.type,
                status='success'
            ).inc()

            return result

        except Exception as e:
            # Record failure
            task_counter.labels(
                agent_type=self.type,
                status='failure'
            ).inc()
            raise

        finally:
            # Record duration
            duration = time.time() - start_time
            task_duration.labels(agent_type=self.type).observe(duration)
            active_agents.dec()
```

### 3. Distributed Tracing

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

class TracedAgent:
    def run(self, task: str) -> dict:
        """Agent with distributed tracing"""

        with tracer.start_as_current_span("agent.run") as span:
            span.set_attribute("task", task)
            span.set_attribute("agent.id", self.agent_id)

            # Planning phase
            with tracer.start_as_current_span("agent.plan"):
                plan = self._create_plan(task)
                span.set_attribute("plan.steps", len(plan))

            # Execution phase
            with tracer.start_as_current_span("agent.execute"):
                result = self._execute_plan(plan)

            span.set_attribute("success", result['success'])
            return result
```

## Cost Optimization

### 1. Model Selection

```python
class CostOptimizedAgent:
    """Use appropriate model for task complexity"""

    def run(self, task: str) -> dict:
        # Classify task complexity
        complexity = self._assess_complexity(task)

        # Select model based on complexity
        if complexity == "simple":
            model = "gpt-3.5-turbo"  # Cheaper
        elif complexity == "medium":
            model = "gpt-4"
        else:
            model = "gpt-4"  # or "claude-opus" for hardest tasks

        result = self.llm.generate(
            prompt=self._build_prompt(task),
            model=model
        )

        return result

    def _assess_complexity(self, task: str) -> str:
        """Assess task complexity"""
        # Simple heuristics or classifier
        if len(task.split()) < 20 and "?" in task:
            return "simple"
        elif any(word in task.lower() for word in ["analyze", "compare", "evaluate"]):
            return "complex"
        else:
            return "medium"
```

### 2. Prompt Caching

```python
# Use cached prompts when possible
class CachedPromptAgent:
    def __init__(self):
        self.system_prompt = """
        [Long system instructions that don't change]
        """

    def run(self, task: str):
        # Only task changes, system prompt is cached by provider
        response = self.llm.generate(
            system=self.system_prompt,  # Cached
            user=task  # New each time
        )
        return response
```

## Documentation Best Practices

### 1. Clear Component Documentation

```python
class SearchAgent:
    """
    Agent specialized in information retrieval.

    This agent uses multiple search strategies to find relevant
    information and synthesizes results into coherent answers.

    Capabilities:
        - Web search using multiple search engines
        - Document search in internal knowledge base
        - Semantic search using vector embeddings

    Limitations:
        - Cannot access content behind paywalls
        - Limited to English language queries
        - May struggle with very recent information (< 24 hours)

    Example:
        >>> agent = SearchAgent(llm, search_tools)
        >>> result = agent.run("Latest developments in quantum computing")
        >>> print(result['answer'])

    Args:
        llm: Language model instance
        search_tools: List of search tool instances
        max_results: Maximum number of search results to process (default: 10)

    Returns:
        Dictionary with keys:
            - answer: Synthesized answer to query
            - sources: List of source URLs
            - confidence: Confidence score (0-1)
    """
```

### 2. Decision Documentation

```python
# Document why decisions were made
class MyAgent:
    """
    Architecture Decisions:

    1. Why ReAct pattern?
       - Provides interpretability through reasoning traces
       - Allows easy debugging of tool selection
       - More reliable than Plan-and-Execute for our use case

    2. Why vector memory instead of knowledge graph?
       - Simpler to implement and maintain
       - Sufficient for our current needs
       - Can upgrade later if needed

    3. Why this tool set?
       - Covers 90% of use cases based on user research
       - Each tool has been tested for safety
       - Limited set reduces confusion in tool selection
    """
```

## Configuration Management

```python
# Use configuration files
from dataclasses import dataclass
import yaml

@dataclass
class AgentConfig:
    """Agent configuration"""
    model: str = "gpt-4"
    temperature: float = 0.7
    max_steps: int = 10
    timeout: int = 300
    allowed_tools: List[str] = None
    memory_type: str = "vector"
    log_level: str = "INFO"

    @classmethod
    def from_file(cls, config_file: str):
        """Load from YAML file"""
        with open(config_file) as f:
            config_dict = yaml.safe_load(f)
        return cls(**config_dict)

# Usage
config = AgentConfig.from_file("agent_config.yaml")
agent = Agent(config=config)
```

## Version Control Best Practices

```python
# Track agent versions
class VersionedAgent:
    VERSION = "2.1.0"

    def __init__(self):
        self.version = self.VERSION

    def run(self, task: str) -> dict:
        result = self._execute(task)

        # Include version in result for tracking
        result['agent_version'] = self.version

        return result
```

## Summary Checklist

- [ ] Start with simple implementation, add complexity iteratively
- [ ] Use clear interfaces and protocols
- [ ] Implement comprehensive error handling
- [ ] Add logging and monitoring from day one
- [ ] Write tests at multiple levels (unit, integration, e2e)
- [ ] Optimize for cost and performance
- [ ] Document decisions and trade-offs
- [ ] Use configuration management
- [ ] Version your agents
- [ ] Monitor in production
- [ ] Regular security audits
- [ ] Gather user feedback
- [ ] Iterate based on real usage

## Next Steps

- Study **production deployment** strategies
- Learn about **continuous improvement** based on monitoring
- Explore **advanced optimization** techniques
- Understand **team collaboration** on agent projects
