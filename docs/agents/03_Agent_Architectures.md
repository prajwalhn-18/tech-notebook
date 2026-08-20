---
sidebar_position: 3
---

# Agent Architectures

Different agent architectures are suited for different types of tasks. Understanding these patterns helps you choose the right approach for your use case.

## 1. ReAct (Reasoning + Acting)

The most popular and versatile agent architecture, developed by researchers at Google and Princeton.

### Concept

ReAct alternates between **reasoning** (thinking about what to do) and **acting** (executing actions), creating a trace of thoughts and actions.

### Architecture Flow

```
User Input → Thought → Action → Observation → Thought → Action → ... → Answer
```

### Example Trace

```
Question: What is the population of the capital of France?

Thought: I need to first identify the capital of France, then find its population.
Action: search("capital of France")
Observation: Paris is the capital and most populous city of France.

Thought: Now I know the capital is Paris. I need to find its population.
Action: search("population of Paris 2024")
Observation: The population of Paris is approximately 2.2 million in the city proper,
and about 12.5 million in the metropolitan area.

Thought: I now have the information needed to answer the question.
Answer: The capital of France is Paris, with a population of approximately 2.2 million
in the city proper (or 12.5 million including the metropolitan area).
```

### Implementation

```python
class ReActAgent:
    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools

    def run(self, question: str, max_steps=10):
        """Execute ReAct loop"""
        thoughts = []
        actions = []
        observations = []

        prompt = self._build_initial_prompt(question)

        for step in range(max_steps):
            # Generate thought and action
            response = self.llm.generate(prompt)

            thought, action = self._parse_response(response)
            thoughts.append(thought)

            if action.type == "Answer":
                return action.content

            # Execute action
            observation = self._execute_action(action)
            observations.append(observation)

            # Update prompt with new information
            prompt = self._update_prompt(thought, action, observation)

        return "Max steps reached without answer"

    def _build_initial_prompt(self, question: str) -> str:
        return f"""
Answer the following question by alternating between Thought, Action, and Observation.

Available actions:
{self._format_tools()}

Question: {question}

Thought: Let me think about how to approach this...
"""

    def _format_tools(self) -> str:
        """Format tool descriptions for prompt"""
        descriptions = []
        for tool in self.tools:
            descriptions.append(f"- {tool.name}: {tool.description}")
        return "\n".join(descriptions)

    def _parse_response(self, response: str):
        """Extract thought and action from LLM response"""
        # Parse "Thought: ..." and "Action: ..." from response
        pass

    def _execute_action(self, action):
        """Execute the specified action"""
        tool = self.tools.get(action.tool_name)
        return tool.execute(**action.parameters)
```

### Advantages
- Interpretable: Clear reasoning trace
- Flexible: Works for various tasks
- Debuggable: Can see where reasoning went wrong

### Disadvantages
- Can be verbose and use many tokens
- May get stuck in reasoning loops
- Each step requires an LLM call

### Best For
- Complex question answering
- Research tasks
- Tasks requiring multi-step reasoning
- When interpretability is important

## 2. Plan-and-Execute

Separates planning from execution: first create a complete plan, then execute each step.

### Architecture Flow

```
User Input → Planning Phase → [Step 1, Step 2, ..., Step N] → Execute Steps → Result
```

### Example

```
Task: Book a flight and hotel for a business trip to San Francisco next month

PLANNING PHASE:
Plan:
1. Determine available dates in next month
2. Search for flights to San Francisco
3. Select best flight option
4. Search for hotels near business district
5. Select hotel based on budget and location
6. Book flight
7. Book hotel
8. Send confirmation email

EXECUTION PHASE:
Executing Step 1: Determine available dates...
Result: Available dates: March 15-18

Executing Step 2: Search for flights...
Result: Found 5 options...

[Continue executing each step]
```

### Implementation

```python
class PlanAndExecuteAgent:
    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools

    def run(self, task: str):
        """Execute plan-and-execute loop"""

        # Phase 1: Planning
        plan = self._create_plan(task)
        print(f"Plan created with {len(plan)} steps")

        # Phase 2: Execution
        results = []
        for i, step in enumerate(plan):
            print(f"Executing step {i+1}: {step}")
            result = self._execute_step(step, results)
            results.append(result)

            # Optional: Re-plan if step fails
            if result.get('error'):
                plan = self._replan(task, plan, i, result)

        # Phase 3: Synthesis
        final_result = self._synthesize_results(task, results)
        return final_result

    def _create_plan(self, task: str) -> list:
        """Generate a step-by-step plan"""
        prompt = f"""
Create a detailed step-by-step plan to accomplish this task:
Task: {task}

Available tools:
{self._format_tools()}

Provide a numbered list of specific steps.
"""
        response = self.llm.generate(prompt)
        return self._parse_plan(response)

    def _execute_step(self, step: str, previous_results: list) -> dict:
        """Execute a single step with access to previous results"""
        prompt = f"""
Execute the following step:
Step: {step}

Previous results:
{self._format_results(previous_results)}

Determine which tool to use and with what parameters.
"""
        response = self.llm.generate(prompt)
        action = self._parse_action(response)
        return self._execute_action(action)
```

### Advantages
- Clear structure and progress tracking
- Can estimate time/cost upfront
- Easier to parallelize independent steps
- Better for complex, multi-stage tasks

### Disadvantages
- Less adaptive to unexpected results
- Initial planning overhead
- May create overly rigid plans

### Best For
- Multi-stage workflows
- Tasks with clear structure
- When you need progress tracking
- Parallelizable tasks

## 3. Reflexion (Self-Reflection)

Agents that learn from mistakes by reflecting on failures and adjusting their approach.

### Architecture Flow

```
Attempt → Evaluate → Reflect → Store Reflection → Retry with Reflection
```

### Example

```
Task: Debug a failing test

ATTEMPT 1:
Action: Run test
Result: Test failed with "TypeError: undefined is not a function"
Evaluation: Failed ❌

REFLECTION:
The error suggests we're calling a function that doesn't exist.
I should examine the test file and the code being tested to find
where undefined function is called.

ATTEMPT 2:
Action: Read test file and source code
Result: Found that helper function was renamed but test wasn't updated
Action: Update test to use new function name
Result: Test passed ✓
Evaluation: Success ✅

LEARNING:
When seeing "undefined is not a function" errors, check for:
1. Renamed or moved functions
2. Import statements
3. Function name typos
```

### Implementation

```python
class ReflexionAgent:
    def __init__(self, llm, tools, max_attempts=3):
        self.llm = llm
        self.tools = tools
        self.max_attempts = max_attempts
        self.reflection_memory = []

    def run(self, task: str):
        """Execute with reflection loop"""

        for attempt in range(self.max_attempts):
            print(f"Attempt {attempt + 1}")

            # Execute attempt
            result = self._attempt_task(task, self.reflection_memory)

            # Evaluate result
            success, evaluation = self._evaluate_result(result, task)

            if success:
                return result

            # Reflect on failure
            reflection = self._reflect(task, result, evaluation)
            self.reflection_memory.append(reflection)

            print(f"Reflection: {reflection}")

        return {"error": "Max attempts reached", "attempts": self.reflection_memory}

    def _reflect(self, task: str, result: dict, evaluation: str) -> str:
        """Generate reflection on failure"""
        prompt = f"""
Task: {task}
Result: {result}
Evaluation: {evaluation}

Reflect on what went wrong and how to improve the next attempt.
What specific changes should be made?
"""
        return self.llm.generate(prompt)
```

### Advantages
- Learns from failures
- More robust to errors
- Improves over multiple attempts
- Builds reusable knowledge

### Disadvantages
- Multiple attempts increase cost
- Can be slow for time-sensitive tasks
- Requires good evaluation function

### Best For
- Complex problem-solving
- Coding tasks (debugging, test generation)
- Tasks where initial attempts often fail
- Building agent expertise over time

## 4. Multi-Agent Collaboration

Multiple specialized agents work together, each with specific roles and expertise.

### Architecture Patterns

#### Hierarchical

```
        Manager Agent
             |
    +--------+--------+
    |        |        |
Research  Analysis  Report
 Agent     Agent     Agent
```

#### Peer-to-Peer

```
Agent A ←→ Agent B ←→ Agent C
   ↑                      ↓
   └──────────────────────┘
```

### Example: Software Development Team

```python
class MultiAgentSystem:
    def __init__(self, llm):
        # Define specialized agents
        self.agents = {
            'product_manager': Agent(
                llm,
                role="Product Manager",
                expertise="Requirements and specifications",
                goal="Define clear requirements"
            ),
            'architect': Agent(
                llm,
                role="Software Architect",
                expertise="System design and architecture",
                goal="Design scalable solutions"
            ),
            'developer': Agent(
                llm,
                role="Developer",
                expertise="Code implementation",
                goal="Write clean, working code"
            ),
            'qa': Agent(
                llm,
                role="QA Engineer",
                expertise="Testing and quality assurance",
                goal="Ensure code quality"
            )
        }

    def run(self, task: str):
        """Execute multi-agent workflow"""

        # Step 1: PM defines requirements
        requirements = self.agents['product_manager'].run(
            f"Define requirements for: {task}"
        )

        # Step 2: Architect designs solution
        design = self.agents['architect'].run(
            f"Design solution for: {requirements}"
        )

        # Step 3: Developer implements
        code = self.agents['developer'].run(
            f"Implement: {design}"
        )

        # Step 4: QA tests
        test_results = self.agents['qa'].run(
            f"Test this code: {code}"
        )

        # Step 5: Iterate if needed
        if not test_results['passed']:
            code = self.agents['developer'].run(
                f"Fix these issues: {test_results['issues']}"
            )

        return {
            'requirements': requirements,
            'design': design,
            'code': code,
            'tests': test_results
        }
```

### Advantages
- Specialization improves quality
- Parallel execution possible
- Models real-world teams
- Each agent can use different models/tools

### Disadvantages
- Complex coordination
- Expensive (multiple LLM calls)
- Communication overhead
- Harder to debug

### Best For
- Large, complex projects
- Tasks benefiting from diverse expertise
- Simulating team workflows
- When quality is more important than speed

## 5. Tool-Augmented Generation (TAG)

Focused on using tools to enhance generation quality rather than complex reasoning.

### Architecture

```
User Query → Generate with Tool Placeholders → Execute Tools → Fill in Results → Final Response
```

### Example

```
Query: "Write a report on recent AI developments"

Generation with placeholders:
"According to recent data [SEARCH: latest AI breakthroughs 2024],
the field has seen significant advances. Specifically,
[SEARCH: GPT-4 improvements] and [SEARCH: AI in healthcare 2024].
Based on analysis [ANALYZE_DATA: ai_trends.csv], we can see..."

Execute tools:
- SEARCH: latest AI breakthroughs 2024 → Results
- SEARCH: GPT-4 improvements → Results
- SEARCH: AI in healthcare 2024 → Results
- ANALYZE_DATA: ai_trends.csv → Analysis

Final response:
"According to recent data showing GPT-4's multimodal capabilities...,
the field has seen significant advances. Specifically,
in medical diagnosis accuracy... Based on analysis showing 40% growth..."
```

### Best For
- Content generation tasks
- When tools enhance accuracy
- Fact-checking and verification
- Data-driven writing

## 6. Cognitive Architectures (Inspired by Human Cognition)

### SOAR (State, Operator, And Result)

```python
class SOARAgent:
    """
    SOAR cognitive architecture implementation
    """
    def __init__(self):
        self.working_memory = {}  # Current state
        self.procedural_memory = {}  # If-then rules
        self.episodic_memory = []  # Past experiences
        self.semantic_memory = {}  # Facts and knowledge

    def run(self, initial_state, goal):
        """Execute SOAR cycle"""
        state = initial_state

        while not self._is_goal_achieved(state, goal):
            # Elaboration: Add to working memory
            self._elaborate(state)

            # Decision: Select operator
            operator = self._select_operator(state, goal)

            # Application: Apply operator
            state = self._apply_operator(operator, state)

            # Learning: Store experience
            self._learn_from_experience(state, operator)

        return state
```

## Choosing the Right Architecture

| Architecture | Complexity | Cost | Interpretability | Best Use Case |
|-------------|-----------|------|------------------|---------------|
| ReAct | Medium | High | High | General purpose, QA |
| Plan-and-Execute | High | Medium | High | Workflows, multi-stage tasks |
| Reflexion | High | Very High | High | Problem-solving, debugging |
| Multi-Agent | Very High | Very High | Medium | Complex projects, teamwork |
| Tool-Augmented | Low | Low | Medium | Content generation |

## Hybrid Approaches

Most production agents combine multiple architectures:

```python
class HybridAgent:
    """
    Combines Plan-and-Execute with ReAct and Reflexion
    """
    def run(self, task):
        # Start with planning
        plan = self.create_plan(task)

        # Execute each step with ReAct
        for step in plan:
            max_attempts = 3
            for attempt in range(max_attempts):
                result = self.react_execute(step)

                if self.evaluate(result):
                    break
                else:
                    # Use reflexion to improve
                    reflection = self.reflect(step, result)
                    step = self.refine_step(step, reflection)

        return self.synthesize_results()
```

## Next Steps

- Explore **tool integration** patterns
- Learn about **memory systems** for agents
- Study **prompt engineering** for each architecture
- Understand **evaluation methods** for agents
