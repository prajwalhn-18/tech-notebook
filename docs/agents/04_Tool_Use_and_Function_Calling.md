---
sidebar_position: 4
---

# Tool Use and Function Calling

Tool use is what transforms language models from conversation systems into agents capable of taking actions in the world.

## Fundamentals

### What is Tool Use?

Tool use (also called function calling) allows LLMs to:
1. Recognize when a tool is needed
2. Select the appropriate tool
3. Generate correct parameters
4. Interpret tool results

### The Tool Use Cycle

```
1. LLM decides a tool is needed
2. LLM generates tool call with parameters
3. System executes tool in controlled environment
4. Tool returns results
5. LLM incorporates results into reasoning
6. Repeat or provide final answer
```

## Tool Definition

### Anatomy of a Tool

```python
from typing import Any, Callable, Dict
from pydantic import BaseModel, Field

class ToolParameter(BaseModel):
    """Defines a single parameter for a tool"""
    name: str
    type: str  # "string", "number", "boolean", "array", "object"
    description: str
    required: bool = True
    enum: list = None  # Optional list of allowed values

class Tool(BaseModel):
    """Complete tool definition"""
    name: str = Field(..., description="Unique tool identifier")
    description: str = Field(..., description="What the tool does")
    parameters: List[ToolParameter]
    function: Callable

    def to_llm_spec(self) -> dict:
        """Convert to format expected by LLM APIs"""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    param.name: {
                        "type": param.type,
                        "description": param.description,
                        **({"enum": param.enum} if param.enum else {})
                    }
                    for param in self.parameters
                },
                "required": [p.name for p in self.parameters if p.required]
            }
        }

    def execute(self, **kwargs) -> Any:
        """Execute the tool with given arguments"""
        return self.function(**kwargs)
```

### Example Tool Definitions

```python
# Weather Tool
def get_weather(location: str, units: str = "celsius") -> dict:
    """Get current weather for a location"""
    # Implementation
    return {
        "temperature": 22,
        "condition": "sunny",
        "humidity": 65,
        "location": location
    }

weather_tool = Tool(
    name="get_weather",
    description="Get current weather information for a specific location",
    parameters=[
        ToolParameter(
            name="location",
            type="string",
            description="City name or coordinates (e.g., 'London' or '51.5074,-0.1278')",
            required=True
        ),
        ToolParameter(
            name="units",
            type="string",
            description="Temperature units",
            required=False,
            enum=["celsius", "fahrenheit"]
        )
    ],
    function=get_weather
)

# Database Query Tool
def query_database(
    query: str,
    database: str = "default",
    limit: int = 100
) -> list:
    """Execute a read-only database query"""
    # Validation
    if not query.strip().upper().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed")

    # Execute query
    # ...
    return results

database_tool = Tool(
    name="query_database",
    description="Execute a read-only SQL SELECT query against the database",
    parameters=[
        ToolParameter(
            name="query",
            type="string",
            description="SQL SELECT query to execute",
            required=True
        ),
        ToolParameter(
            name="database",
            type="string",
            description="Database name to query",
            required=False
        ),
        ToolParameter(
            name="limit",
            type="number",
            description="Maximum number of rows to return",
            required=False
        )
    ],
    function=query_database
)
```

## Function Calling Protocols

Different LLM providers have different formats for function calling.

### OpenAI Format

```python
# Tool specification
tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get current weather",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City name"
                },
                "units": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"]
                }
            },
            "required": ["location"]
        }
    }
}]

# API Call
response = openai.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=tools,
    tool_choice="auto"  # "auto", "none", or {"type": "function", "function": {"name": "get_weather"}}
)

# Response with function call
{
    "role": "assistant",
    "content": null,
    "tool_calls": [{
        "id": "call_123",
        "type": "function",
        "function": {
            "name": "get_weather",
            "arguments": '{"location": "Paris", "units": "celsius"}'
        }
    }]
}

# Execute function and continue
messages.append(response.choices[0].message)
messages.append({
    "role": "tool",
    "tool_call_id": "call_123",
    "content": json.dumps({"temperature": 18, "condition": "cloudy"})
})

# Get final response
final_response = openai.chat.completions.create(
    model="gpt-4",
    messages=messages
)
```

### Anthropic Claude Format

```python
# Tool specification
tools = [{
    "name": "get_weather",
    "description": "Get current weather for a location",
    "input_schema": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "City name"
            },
            "units": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"]
            }
        },
        "required": ["location"]
    }
}]

# API Call
response = anthropic.messages.create(
    model="claude-3-opus-20240229",
    messages=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=tools,
    max_tokens=1024
)

# Response with tool use
{
    "role": "assistant",
    "content": [
        {
            "type": "text",
            "text": "I'll check the weather in Paris for you."
        },
        {
            "type": "tool_use",
            "id": "toolu_123",
            "name": "get_weather",
            "input": {
                "location": "Paris",
                "units": "celsius"
            }
        }
    ]
}

# Execute and continue
messages.append({
    "role": "assistant",
    "content": response.content
})
messages.append({
    "role": "user",
    "content": [{
        "type": "tool_result",
        "tool_use_id": "toolu_123",
        "content": json.dumps({"temperature": 18, "condition": "cloudy"})
    }]
})
```

### Generic Prompt-Based Approach

For models without native function calling:

```python
def format_tools_for_prompt(tools: List[Tool]) -> str:
    """Format tools as text for prompt"""
    tool_descriptions = []
    for tool in tools:
        params = ", ".join([
            f"{p.name}: {p.type}" + (" (required)" if p.required else " (optional)")
            for p in tool.parameters
        ])
        tool_descriptions.append(
            f"- {tool.name}({params}): {tool.description}"
        )
    return "\n".join(tool_descriptions)

prompt = f"""
You have access to the following tools:

{format_tools_for_prompt(tools)}

To use a tool, respond with:
TOOL: tool_name
ARGS: {{"param": "value"}}

User: What's the weather in Paris?
Assistant: TOOL: get_weather
ARGS: {{"location": "Paris", "units": "celsius"}}
"""
```

## Tool Execution Framework

### Safe Execution Environment

```python
class ToolExecutor:
    def __init__(self, tools: List[Tool], timeout: int = 30):
        self.tools = {tool.name: tool for tool in tools}
        self.timeout = timeout

    def execute(self, tool_name: str, arguments: dict) -> dict:
        """Safely execute a tool"""

        # Validate tool exists
        if tool_name not in self.tools:
            return {
                "success": False,
                "error": f"Tool '{tool_name}' not found"
            }

        tool = self.tools[tool_name]

        try:
            # Validate arguments
            self._validate_arguments(tool, arguments)

            # Execute with timeout
            result = self._execute_with_timeout(
                tool.function,
                arguments,
                self.timeout
            )

            return {
                "success": True,
                "result": result
            }

        except ValidationError as e:
            return {
                "success": False,
                "error": f"Invalid arguments: {str(e)}"
            }
        except TimeoutError:
            return {
                "success": False,
                "error": f"Tool execution exceeded {self.timeout}s timeout"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Tool execution failed: {str(e)}"
            }

    def _validate_arguments(self, tool: Tool, arguments: dict):
        """Validate arguments match tool specification"""
        required_params = {p.name for p in tool.parameters if p.required}
        provided_params = set(arguments.keys())

        # Check required parameters
        missing = required_params - provided_params
        if missing:
            raise ValidationError(f"Missing required parameters: {missing}")

        # Validate types and enums
        for param in tool.parameters:
            if param.name in arguments:
                value = arguments[param.name]

                # Type checking
                if not self._check_type(value, param.type):
                    raise ValidationError(
                        f"Parameter '{param.name}' must be {param.type}"
                    )

                # Enum validation
                if param.enum and value not in param.enum:
                    raise ValidationError(
                        f"Parameter '{param.name}' must be one of {param.enum}"
                    )

    def _execute_with_timeout(self, func: Callable, args: dict, timeout: int):
        """Execute function with timeout"""
        import signal

        def timeout_handler(signum, frame):
            raise TimeoutError()

        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(timeout)

        try:
            result = func(**args)
        finally:
            signal.alarm(0)

        return result
```

### Sandboxing and Security

```python
class SecureToolExecutor(ToolExecutor):
    """Executor with additional security controls"""

    def __init__(self, tools: List[Tool], config: SecurityConfig):
        super().__init__(tools)
        self.config = config

    def execute(self, tool_name: str, arguments: dict) -> dict:
        """Execute with security checks"""

        # Check rate limits
        if self._is_rate_limited(tool_name):
            return {
                "success": False,
                "error": "Rate limit exceeded"
            }

        # Check permissions
        if not self._has_permission(tool_name):
            return {
                "success": False,
                "error": "Permission denied"
            }

        # Sanitize inputs
        arguments = self._sanitize_inputs(arguments)

        # Execute in sandbox
        result = self._execute_sandboxed(tool_name, arguments)

        # Log execution
        self._log_execution(tool_name, arguments, result)

        return result

    def _execute_sandboxed(self, tool_name: str, arguments: dict):
        """Execute tool in isolated environment"""
        # Use containers, VMs, or process isolation
        pass
```

## Advanced Tool Patterns

### Composite Tools

```python
class CompositeTool(Tool):
    """Tool that combines multiple sub-tools"""

    def __init__(self, name: str, sub_tools: List[Tool]):
        self.sub_tools = {tool.name: tool for tool in sub_tools}

        super().__init__(
            name=name,
            description=f"Composite tool with: {', '.join(self.sub_tools.keys())}",
            parameters=[],
            function=self._execute_composite
        )

    def _execute_composite(self, workflow: list) -> dict:
        """Execute a workflow of sub-tools"""
        results = []
        context = {}

        for step in workflow:
            tool_name = step['tool']
            args = step['arguments']

            # Resolve arguments from context
            args = self._resolve_context(args, context)

            # Execute sub-tool
            result = self.sub_tools[tool_name].execute(**args)
            results.append(result)

            # Update context
            context[step.get('output_var', f'step_{len(results)}')] = result

        return {
            'steps': results,
            'final_result': results[-1] if results else None
        }
```

### Streaming Tools

```python
class StreamingTool(Tool):
    """Tool that yields results incrementally"""

    def execute_stream(self, **kwargs):
        """Execute and yield results as they become available"""
        for chunk in self.function(**kwargs):
            yield {
                'type': 'chunk',
                'data': chunk
            }

        yield {
            'type': 'done'
        }

# Usage
for event in streaming_tool.execute_stream(query="large dataset"):
    if event['type'] == 'chunk':
        print(f"Received: {event['data']}")
    elif event['type'] == 'done':
        print("Complete")
```

### Tool Chaining

```python
class ToolChain:
    """Automatically chain tool calls"""

    def __init__(self, tools: List[Tool]):
        self.tools = {tool.name: tool for tool in tools}

    def execute_chain(self, initial_tool: str, initial_args: dict):
        """Execute tools in sequence based on outputs"""
        current_tool = initial_tool
        current_args = initial_args
        results = []

        while current_tool:
            result = self.tools[current_tool].execute(**current_args)
            results.append({
                'tool': current_tool,
                'result': result
            })

            # Determine next tool based on result
            next_tool, next_args = self._get_next_tool(result)
            current_tool = next_tool
            current_args = next_args

        return results
```

## Best Practices

### 1. Clear Tool Descriptions

```python
# Bad
"query db"

# Good
"Execute a read-only SQL SELECT query against the production database. "
"Returns up to 1000 rows. Only SELECT statements are allowed. "
"Use for retrieving user data, orders, or analytics."
```

### 2. Parameter Validation

```python
def search_tool(query: str, num_results: int = 10):
    # Validate inputs
    if not query or len(query) < 3:
        raise ValueError("Query must be at least 3 characters")

    if num_results < 1 or num_results > 100:
        raise ValueError("num_results must be between 1 and 100")

    # Execute search
    ...
```

### 3. Meaningful Error Messages

```python
try:
    result = api.call()
except APIError as e:
    # Don't just return error to LLM
    return {
        "error": str(e),
        "suggestion": "Try reducing the page size parameter",
        "retry_possible": True
    }
```

### 4. Tool Result Format

```python
# Consistent structure for all tool results
{
    "success": bool,
    "data": any,  # Tool-specific result
    "error": str | None,
    "metadata": {
        "execution_time": float,
        "tokens_used": int,
        "cost": float
    }
}
```

### 5. Rate Limiting and Quotas

```python
class RateLimitedTool(Tool):
    def __init__(self, *args, calls_per_minute=10, **kwargs):
        super().__init__(*args, **kwargs)
        self.rate_limiter = RateLimiter(calls_per_minute)

    def execute(self, **kwargs):
        if not self.rate_limiter.allow():
            raise RateLimitError(
                f"Rate limit exceeded. "
                f"Tool '{self.name}' allows {self.rate_limiter.limit} calls per minute"
            )

        return super().execute(**kwargs)
```

## Testing Tools

```python
import pytest

def test_weather_tool():
    tool = weather_tool

    # Test successful execution
    result = tool.execute(location="London", units="celsius")
    assert result['temperature'] is not None
    assert result['location'] == "London"

    # Test parameter validation
    with pytest.raises(ValidationError):
        tool.execute()  # Missing required parameter

    with pytest.raises(ValidationError):
        tool.execute(location="London", units="kelvin")  # Invalid enum

    # Test error handling
    result = tool.execute(location="InvalidCity123")
    assert 'error' in result
```

## Next Steps

- Learn about **memory systems** for maintaining context across tool calls
- Explore **prompt engineering** techniques for better tool selection
- Study **multi-agent systems** where agents use different tool sets
- Understand **evaluation methods** for tool use quality
