---
sidebar_position: 6
---

# Prompt Engineering for Agents

Effective prompt engineering is crucial for agent performance. The quality of your prompts directly impacts the agent's reasoning, tool selection, and overall success rate.

## Core Principles

### 1. Be Specific and Clear

```python
# Bad
"Do something with this data"

# Good
"""
Analyze the customer_data.csv file and:
1. Calculate average order value by customer segment
2. Identify the top 10 customers by revenue
3. Suggest three strategies to increase retention in the lowest-performing segment

Use the analyze_csv and generate_insights tools.
"""
```

### 2. Provide Context

```python
system_prompt = """
You are a customer support agent for TechCorp, a B2B SaaS company.

Company Context:
- Product: Project management software
- Customers: Mid-size tech companies (50-500 employees)
- Common issues: Integration problems, user onboarding, billing questions

Your Goals:
1. Resolve customer issues efficiently
2. Maintain a professional but friendly tone
3. Escalate to human agents when dealing with refunds over $1000

Available Tools:
- search_knowledge_base: Search internal documentation
- check_account_status: View customer account details
- create_ticket: Create a support ticket for human follow-up
"""
```

### 3. Structure for Reasoning

```python
prompt_template = """
Task: {task}

Before taking action, think through these steps:
1. What information do I need to complete this task?
2. Which tools are most appropriate?
3. What is the logical sequence of actions?
4. What could go wrong, and how should I handle it?

Now, proceed with solving the task:
"""
```

## Prompt Patterns for Agents

### Pattern 1: ReAct Prompting

```python
REACT_PROMPT = """
Answer the following question using this format:

Thought: [Your reasoning about what to do next]
Action: [The action to take - either use a tool or provide the final answer]
Action Input: [The input for the action]
Observation: [The result of the action]
... (repeat Thought/Action/Observation as needed)
Thought: [Final reasoning]
Final Answer: [Your conclusion]

Available Actions:
{tool_descriptions}

Question: {question}

Begin!

Thought:"""
```

**Example usage:**

```python
tools_description = """
- search_wikipedia(query: str) -> str: Search Wikipedia for information
- calculator(expression: str) -> float: Evaluate a mathematical expression
- final_answer(answer: str) -> str: Provide the final answer to the user
"""

question = "What is the population of Tokyo multiplied by 2?"

prompt = REACT_PROMPT.format(
    tool_descriptions=tools_description,
    question=question
)
```

### Pattern 2: Plan-and-Execute Prompting

```python
PLANNING_PROMPT = """
You are a planning agent. Given a task, break it down into specific, actionable steps.

Task: {task}

Available Tools:
{tools}

Create a step-by-step plan where each step:
1. Has a clear action (which tool to use)
2. Specifies the expected input
3. Describes what information the step will produce
4. Explains how it contributes to the overall goal

Format your plan as:
Step 1: [Action] - [Description]
Step 2: [Action] - [Description]
...

Plan:
"""

EXECUTION_PROMPT = """
Execute the following step from the plan:

Step: {step}
Context from previous steps: {context}

Available Tools:
{tools}

Determine the exact tool to use and parameters, then execute it.

Tool: [tool_name]
Parameters: [parameters as JSON]
"""
```

### Pattern 3: Few-Shot Examples

```python
FEW_SHOT_PROMPT = """
You are a code debugging agent. Analyze errors and suggest fixes.

Example 1:
Error: TypeError: Cannot read property 'map' of undefined
Context: users.map(u => u.name)
Analysis: The 'users' variable is undefined. Check if data was successfully fetched.
Fix: Add null check: users?.map(u => u.name) or verify fetch logic

Example 2:
Error: ReferenceError: axios is not defined
Context: const response = axios.get('/api/users')
Analysis: axios library is not imported
Fix: Add import statement: import axios from 'axios'

Example 3:
Error: SyntaxError: Unexpected token ':'
Context: const obj = {name: 'John' age: 30}
Analysis: Missing comma between object properties
Fix: Add comma: {name: 'John', age: 30}

Now analyze this error:
Error: {error}
Context: {code_context}

Analysis:"""
```

### Pattern 4: Chain-of-Thought (CoT)

```python
COT_PROMPT = """
Let's solve this step by step, showing all reasoning:

Problem: {problem}

Step 1: Understand the problem
[Break down what is being asked]

Step 2: Identify what information we have
[List known information]

Step 3: Determine what we need to find out
[List unknowns]

Step 4: Choose the approach
[Explain the strategy]

Step 5: Execute the solution
[Show the work]

Step 6: Verify the answer
[Check if the solution makes sense]

Final Answer:
"""
```

### Pattern 5: Self-Consistency

```python
SELF_CONSISTENCY_PROMPT = """
Generate multiple different reasoning paths for this problem,
then determine the most consistent answer.

Problem: {problem}

Reasoning Path 1:
[First approach]
Answer: [Result 1]

Reasoning Path 2:
[Second approach]
Answer: [Result 2]

Reasoning Path 3:
[Third approach]
Answer: [Result 3]

Analysis of consistency:
[Compare the three answers and reasoning]

Most reliable answer: [The answer that appears most often or has the strongest reasoning]
"""
```

## Tool Selection Prompting

### Clear Tool Descriptions

```python
def format_tool_for_prompt(tool):
    """Format tool description for optimal LLM understanding"""

    return f"""
Tool: {tool.name}

Purpose: {tool.description}

When to use:
{tool.use_cases}

Parameters:
{format_parameters(tool.parameters)}

Example usage:
{tool.example}

Returns:
{tool.return_description}
"""

# Example
calculator_tool = """
Tool: calculator

Purpose: Perform mathematical calculations including arithmetic, algebra, and basic functions.

When to use:
- Need to compute numerical results
- Solving mathematical expressions
- Comparing numerical values

Parameters:
- expression (string, required): Mathematical expression to evaluate
  Examples: "2 + 2", "sqrt(16) * 3", "(10 + 5) / 3"

Example usage:
calculator(expression="15 * 7 + 3")

Returns:
A number (float or integer) representing the calculated result
"""
```

### Tool Selection Guidance

```python
TOOL_SELECTION_PROMPT = """
Given the current task and available tools, determine which tool to use.

Current Task: {task}
Current Context: {context}

Available Tools:
{tools}

Selection Criteria:
1. Does the tool directly help accomplish the task?
2. Do you have all required parameters?
3. Is this the most efficient tool for the job?
4. Have you already tried this tool and failed?

Think through each tool:
{tool_names[0]}: [Would this help? Why or why not?]
{tool_names[1]}: [Would this help? Why or why not?]
...

Selected Tool: [Tool name]
Reasoning: [Why this tool is the best choice]
Parameters: [Specific parameters to use]
"""
```

## Error Handling Prompts

### Graceful Failure Recovery

```python
ERROR_RECOVERY_PROMPT = """
The previous action failed with the following error:

Error: {error_message}
Action that failed: {failed_action}
Parameters used: {parameters}

Analyze the error:
1. What went wrong?
2. Why did it fail?
3. Can it be retried with different parameters?
4. Should we try a different approach?
5. Is this a fatal error that requires human intervention?

Recovery Strategy:
[Describe what to do next]

Next Action:
"""
```

### Validation Prompts

```python
VALIDATION_PROMPT = """
Before executing this action, validate it:

Intended Action: {action}
Parameters: {parameters}
Expected Outcome: {expected_outcome}

Pre-flight Checks:
1. Are all required parameters present and valid?
2. Do the parameters make sense for this tool?
3. Could this action have unintended consequences?
4. Is there a safer or more efficient alternative?
5. Do I have the necessary permissions?

Validation Result: [PASS/FAIL]
Reasoning: [Explanation]

If PASS, proceed with action.
If FAIL, explain what needs to be corrected.
"""
```

## Memory-Aware Prompts

### Incorporating Context

```python
MEMORY_AWARE_PROMPT = """
Current Task: {task}

Relevant Context from Memory:
---
Recent Conversation:
{short_term_memory}

Relevant Past Information:
{long_term_memory}

Similar Past Experiences:
{episodic_memory}

Applicable Procedures:
{procedural_memory}
---

Given this context, determine the best approach to the current task.
Consider what has worked before and what hasn't.

Approach:
"""
```

### Learning from History

```python
LEARNING_PROMPT = """
Review this completed task and extract learnings:

Task: {task}
Actions Taken: {actions}
Outcome: {outcome}
Success: {success}

Reflection:
1. What worked well?
2. What could have been done better?
3. What should be remembered for similar future tasks?
4. Are there any patterns or heuristics to extract?

Key Learnings:
- [Learning 1]
- [Learning 2]
- [Learning 3]

Store these learnings in memory for future reference.
"""
```

## Advanced Techniques

### 1. Meta-Prompting

```python
META_PROMPT = """
You are a meta-agent that helps improve other agents' prompts.

Current Agent Prompt:
{current_prompt}

Agent's Recent Performance:
- Success Rate: {success_rate}
- Common Failures: {common_failures}
- Average Steps to Completion: {avg_steps}

Analyze the prompt and suggest improvements:
1. Is the objective clear?
2. Are the available tools well-described?
3. Is the reasoning structure appropriate?
4. Are there missing constraints or guidelines?
5. Could examples help?

Suggested Improved Prompt:
"""
```

### 2. Dynamic Prompt Generation

```python
def generate_context_aware_prompt(task, agent_state, history):
    """Generate prompt tailored to current context"""

    # Analyze task complexity
    complexity = estimate_complexity(task)

    # Check agent's expertise with similar tasks
    expertise_level = check_expertise(history, task)

    # Select appropriate prompt template
    if complexity == "high" and expertise_level == "low":
        template = DETAILED_STEP_BY_STEP_PROMPT
    elif complexity == "low" and expertise_level == "high":
        template = CONCISE_PROMPT
    else:
        template = STANDARD_PROMPT

    # Add relevant examples from history
    examples = find_similar_successful_tasks(history, task)

    # Assemble final prompt
    return template.format(
        task=task,
        examples=examples,
        agent_state=agent_state
    )
```

### 3. Retrieval-Augmented Prompts

```python
RAG_PROMPT = """
Task: {task}

Retrieved Relevant Information:
{retrieved_docs}

Instructions:
1. First, review the retrieved information above
2. Determine which parts are relevant to the task
3. Use this information to inform your approach
4. If the information is insufficient, use the search tool to find more
5. Cite sources when using retrieved information

Approach:
"""
```

## Prompt Optimization

### A/B Testing Prompts

```python
class PromptExperiment:
    def __init__(self):
        self.variants = {}
        self.results = {}

    def add_variant(self, name: str, prompt: str):
        """Add a prompt variant to test"""
        self.variants[name] = prompt
        self.results[name] = []

    def run_experiment(self, task: str, n_trials: int = 10):
        """Test all variants"""
        for variant_name, prompt in self.variants.items():
            for i in range(n_trials):
                result = self.agent.run(prompt.format(task=task))
                self.results[variant_name].append({
                    'success': result.success,
                    'steps': result.steps,
                    'cost': result.cost
                })

    def analyze_results(self):
        """Compare variant performance"""
        for variant, results in self.results.items():
            success_rate = sum(r['success'] for r in results) / len(results)
            avg_steps = sum(r['steps'] for r in results) / len(results)
            avg_cost = sum(r['cost'] for r in results) / len(results)

            print(f"{variant}:")
            print(f"  Success Rate: {success_rate:.2%}")
            print(f"  Avg Steps: {avg_steps:.1f}")
            print(f"  Avg Cost: ${avg_cost:.4f}")
```

### Iterative Refinement

```python
def refine_prompt(initial_prompt, test_cases, iterations=5):
    """Iteratively improve prompt based on performance"""

    current_prompt = initial_prompt
    best_score = 0

    for iteration in range(iterations):
        # Test current prompt
        score = evaluate_prompt(current_prompt, test_cases)

        if score > best_score:
            best_score = score
            best_prompt = current_prompt

        # Generate variations
        variations = generate_prompt_variations(current_prompt)

        # Test variations
        variation_scores = [
            evaluate_prompt(v, test_cases)
            for v in variations
        ]

        # Select best variation
        best_idx = np.argmax(variation_scores)
        current_prompt = variations[best_idx]

        print(f"Iteration {iteration+1}: Score = {score:.3f}")

    return best_prompt
```

## Common Pitfalls and Solutions

### Pitfall 1: Ambiguous Instructions

```python
# Bad
"Fix the code"

# Good
"Debug the authentication function in auth.py:
1. The function is returning None instead of a user object
2. Expected behavior: Return user object when credentials are valid
3. Test with username='test@example.com', password='Test123'
4. Use the debug_trace and test_function tools"
```

### Pitfall 2: Tool Overload

```python
# Bad - Listing 50 tools
"Available tools: [50 tool descriptions]"

# Good - Categorize and filter
"""
Core Tools (use these first):
- search: Find information
- calculator: Do math

Data Tools (for data tasks):
- query_db: Database queries
- analyze_csv: CSV analysis

Admin Tools (rarely needed):
- update_config: Change settings
"""
```

### Pitfall 3: Lack of Examples

```python
# Bad
"Use the API tool to get data"

# Good
"""
Use the API tool to get data. Example:

api_call(
    method="GET",
    endpoint="/users/123",
    headers={"Authorization": "Bearer token"}
)

This returns:
{
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
}
"""
```

## Prompt Templates Library

```python
PROMPT_LIBRARY = {
    "research": """
Research the following topic: {topic}

Steps:
1. Search for general information
2. Identify key subtopics
3. Deep dive into each subtopic
4. Synthesize findings
5. Cite sources

Output format: Structured report with sections
""",

    "debug": """
Debug this issue: {issue_description}

Code context:
{code}

Error:
{error}

Debugging process:
1. Reproduce the error
2. Identify the root cause
3. Propose a fix
4. Test the fix
5. Explain what was wrong
""",

    "analysis": """
Analyze this data: {data_description}

Analysis objectives:
{objectives}

Required outputs:
1. Summary statistics
2. Key insights
3. Visualizations
4. Recommendations

Use appropriate analysis tools and show your work.
"""
}
```

## Next Steps

- Study **evaluation methods** to measure prompt effectiveness
- Learn about **multi-agent systems** with coordinated prompts
- Explore **safety considerations** in prompt design
- Understand **prompt injection** prevention techniques
