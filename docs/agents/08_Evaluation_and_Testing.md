---
sidebar_position: 8
---

# Agent Evaluation and Testing

Evaluating AI agents is challenging due to their complexity, non-determinism, and diverse use cases. This guide covers comprehensive strategies for testing and measuring agent performance.

## Evaluation Dimensions

### 1. Task Success Rate

The most fundamental metric: Does the agent accomplish its goal?

```python
class TaskEvaluator:
    """Evaluate agent task completion"""

    def __init__(self):
        self.results = []

    def evaluate_task(
        self,
        agent,
        task: str,
        expected_outcome: dict,
        validator: Callable
    ) -> dict:
        """Evaluate single task execution"""

        start_time = time.time()

        # Execute task
        try:
            result = agent.run(task)
            execution_time = time.time() - start_time

            # Validate result
            success = validator(result, expected_outcome)

            evaluation = {
                'task': task,
                'success': success,
                'execution_time': execution_time,
                'result': result,
                'error': None
            }

        except Exception as e:
            evaluation = {
                'task': task,
                'success': False,
                'execution_time': time.time() - start_time,
                'result': None,
                'error': str(e)
            }

        self.results.append(evaluation)
        return evaluation

    def calculate_success_rate(self) -> float:
        """Calculate overall success rate"""
        if not self.results:
            return 0.0

        successful = sum(1 for r in self.results if r['success'])
        return successful / len(self.results)

    def get_statistics(self) -> dict:
        """Get evaluation statistics"""
        return {
            'total_tasks': len(self.results),
            'successful': sum(1 for r in self.results if r['success']),
            'failed': sum(1 for r in self.results if not r['success']),
            'success_rate': self.calculate_success_rate(),
            'avg_execution_time': np.mean([
                r['execution_time'] for r in self.results
            ]),
            'error_types': self._categorize_errors()
        }
```

### 2. Efficiency Metrics

How efficiently does the agent complete tasks?

```python
class EfficiencyMetrics:
    """Measure agent efficiency"""

    @staticmethod
    def calculate_metrics(agent_execution: dict) -> dict:
        """Calculate efficiency metrics"""

        return {
            # Steps to completion
            'total_steps': len(agent_execution['steps']),
            'optimal_steps': EfficiencyMetrics._calculate_optimal_steps(
                agent_execution
            ),
            'step_efficiency': EfficiencyMetrics._step_efficiency(
                agent_execution
            ),

            # Token usage
            'total_tokens': agent_execution['token_count'],
            'tokens_per_step': (
                agent_execution['token_count'] /
                len(agent_execution['steps'])
            ),

            # Cost
            'total_cost': agent_execution['cost'],
            'cost_per_step': (
                agent_execution['cost'] /
                len(agent_execution['steps'])
            ),

            # Time
            'total_time': agent_execution['execution_time'],
            'time_per_step': (
                agent_execution['execution_time'] /
                len(agent_execution['steps'])
            ),

            # Tool usage
            'tool_calls': len(agent_execution['tool_calls']),
            'unique_tools': len(set(
                t['tool_name'] for t in agent_execution['tool_calls']
            )),
            'redundant_calls': EfficiencyMetrics._count_redundant_calls(
                agent_execution
            )
        }

    @staticmethod
    def _count_redundant_calls(execution: dict) -> int:
        """Count redundant tool calls"""
        seen_calls = set()
        redundant = 0

        for call in execution['tool_calls']:
            call_signature = f"{call['tool_name']}:{call['parameters']}"
            if call_signature in seen_calls:
                redundant += 1
            seen_calls.add(call_signature)

        return redundant
```

### 3. Quality Assessment

Evaluate the quality of the agent's output.

```python
class QualityEvaluator:
    """Evaluate output quality"""

    def __init__(self, llm):
        self.llm = llm

    def evaluate_quality(
        self,
        task: str,
        agent_output: str,
        criteria: List[str]
    ) -> dict:
        """Evaluate output quality using LLM as judge"""

        prompt = f"""
Evaluate the quality of this agent's output.

Task: {task}

Agent Output:
{agent_output}

Evaluation Criteria:
{self._format_criteria(criteria)}

For each criterion, provide:
1. Score (1-10)
2. Reasoning
3. Specific examples from the output

Format as JSON.
"""

        evaluation = self.llm.generate(prompt)
        scores = self._parse_evaluation(evaluation)

        return {
            'overall_score': np.mean([s['score'] for s in scores.values()]),
            'criterion_scores': scores,
            'raw_evaluation': evaluation
        }

    def compare_outputs(
        self,
        task: str,
        output_a: str,
        output_b: str
    ) -> dict:
        """Compare two agent outputs"""

        prompt = f"""
Compare these two outputs for the same task.

Task: {task}

Output A:
{output_a}

Output B:
{output_b}

Which output is better? Consider:
1. Correctness
2. Completeness
3. Clarity
4. Efficiency

Provide: Winner (A/B/Tie), reasoning, and scores for each criterion.
"""

        comparison = self.llm.generate(prompt)
        return self._parse_comparison(comparison)
```

### 4. Reasoning Quality

Evaluate the agent's reasoning process.

```python
class ReasoningEvaluator:
    """Evaluate reasoning quality"""

    def evaluate_reasoning_trace(
        self,
        trace: List[dict]
    ) -> dict:
        """Analyze reasoning trace"""

        metrics = {
            'logical_consistency': self._check_consistency(trace),
            'goal_directedness': self._measure_goal_directedness(trace),
            'information_usage': self._evaluate_information_usage(trace),
            'adaptability': self._measure_adaptability(trace),
            'dead_ends': self._count_dead_ends(trace),
            'backtracking': self._count_backtracking(trace)
        }

        return metrics

    def _check_consistency(self, trace: List[dict]) -> float:
        """Check if reasoning is internally consistent"""

        # Extract claims from reasoning
        claims = []
        for step in trace:
            if 'thought' in step:
                claims.extend(self._extract_claims(step['thought']))

        # Check for contradictions
        contradictions = self._find_contradictions(claims)

        consistency_score = 1.0 - (len(contradictions) / max(len(claims), 1))
        return consistency_score

    def _measure_goal_directedness(self, trace: List[dict]) -> float:
        """Measure how well reasoning advances toward goal"""

        goal_distance = []

        for step in trace:
            # Estimate distance to goal at each step
            distance = self._estimate_goal_distance(step)
            goal_distance.append(distance)

        # Good reasoning should generally decrease distance to goal
        improvements = sum(
            1 for i in range(1, len(goal_distance))
            if goal_distance[i] < goal_distance[i-1]
        )

        return improvements / max(len(goal_distance) - 1, 1)
```

## Test Suites

### Unit Tests for Agent Components

```python
import pytest

class TestAgentComponents:
    """Unit tests for individual agent components"""

    def test_tool_execution(self):
        """Test tool execution"""
        tool = CalculatorTool()

        # Test basic functionality
        result = tool.execute(expression="2 + 2")
        assert result == 4

        # Test error handling
        with pytest.raises(ValueError):
            tool.execute(expression="invalid")

    def test_memory_storage_and_retrieval(self):
        """Test memory system"""
        memory = LongTermMemory()

        # Store information
        memory.store("Paris is the capital of France", category="geography")

        # Retrieve
        results = memory.retrieve("capital of France")
        assert len(results) > 0
        assert "Paris" in results[0]['content']

    def test_prompt_generation(self):
        """Test prompt generation"""
        prompter = PromptGenerator()

        prompt = prompter.generate_react_prompt(
            task="What is 2+2?",
            tools=["calculator"]
        )

        assert "calculator" in prompt
        assert "2+2" in prompt
```

### Integration Tests

```python
class TestAgentIntegration:
    """Test agent as a complete system"""

    def test_simple_task_completion(self):
        """Test end-to-end task completion"""
        agent = Agent(llm, tools, memory)

        result = agent.run("What is the weather in London?")

        assert result['success'] is True
        assert 'temperature' in result['output'].lower()
        assert 'london' in result['output'].lower()

    def test_multi_step_reasoning(self):
        """Test complex multi-step task"""
        agent = Agent(llm, tools, memory)

        result = agent.run(
            "Find the population of Japan's capital and calculate "
            "what percentage it is of the total country population"
        )

        assert result['success'] is True
        # Verify both searches happened and calculation was performed
        assert len(result['tool_calls']) >= 3

    def test_error_recovery(self):
        """Test agent handles errors gracefully"""
        agent = Agent(llm, tools, memory)

        # Create tool that will fail
        failing_tool = FailingTool()
        agent.tools.register(failing_tool)

        result = agent.run("Use the failing tool")

        # Agent should detect failure and try alternative
        assert result['success'] is True
        assert 'error' in result['trace']
```

### Benchmark Suites

```python
class AgentBenchmark:
    """Comprehensive benchmark suite"""

    def __init__(self):
        self.benchmarks = {
            'reasoning': self._load_reasoning_tasks(),
            'tool_use': self._load_tool_use_tasks(),
            'knowledge': self._load_knowledge_tasks(),
            'planning': self._load_planning_tasks(),
            'robustness': self._load_robustness_tasks()
        }

    def run_benchmark(self, agent, category: str = None) -> dict:
        """Run benchmark suite"""

        results = {}

        categories = [category] if category else self.benchmarks.keys()

        for cat in categories:
            tasks = self.benchmarks[cat]
            category_results = []

            for task in tasks:
                result = self._evaluate_task(agent, task)
                category_results.append(result)

            results[cat] = {
                'tasks': len(tasks),
                'success_rate': self._calculate_success_rate(category_results),
                'avg_score': self._calculate_avg_score(category_results),
                'detailed_results': category_results
            }

        return results

    def _load_reasoning_tasks(self) -> List[dict]:
        """Load reasoning benchmark tasks"""
        return [
            {
                'task': 'Logical deduction problem',
                'input': 'If all A are B, and all B are C, what can we conclude about A and C?',
                'expected': 'All A are C',
                'validator': lambda out, exp: exp.lower() in out.lower()
            },
            # More tasks...
        ]
```

## Evaluation Frameworks

### Automated Evaluation Pipeline

```python
class EvaluationPipeline:
    """Automated evaluation pipeline"""

    def __init__(self):
        self.evaluators = {
            'success': TaskEvaluator(),
            'efficiency': EfficiencyMetrics(),
            'quality': QualityEvaluator(llm),
            'reasoning': ReasoningEvaluator()
        }

    def evaluate_agent(
        self,
        agent,
        test_suite: List[dict],
        metrics: List[str] = None
    ) -> dict:
        """Run comprehensive evaluation"""

        if metrics is None:
            metrics = list(self.evaluators.keys())

        results = {metric: [] for metric in metrics}

        for test_case in test_suite:
            # Run agent on test case
            agent_result = agent.run(test_case['input'])

            # Evaluate with each metric
            for metric in metrics:
                evaluator = self.evaluators[metric]
                score = evaluator.evaluate(
                    test_case,
                    agent_result
                )
                results[metric].append(score)

        # Aggregate results
        summary = self._aggregate_results(results)

        return summary

    def compare_agents(
        self,
        agents: List[Agent],
        test_suite: List[dict]
    ) -> dict:
        """Compare multiple agents"""

        comparison = {}

        for agent in agents:
            results = self.evaluate_agent(agent, test_suite)
            comparison[agent.name] = results

        # Rank agents
        rankings = self._rank_agents(comparison)

        return {
            'individual_results': comparison,
            'rankings': rankings,
            'statistical_significance': self._test_significance(comparison)
        }
```

### Human Evaluation

```python
class HumanEvaluationSystem:
    """System for collecting human evaluations"""

    def __init__(self):
        self.evaluations = []

    def create_evaluation_task(
        self,
        agent_output: str,
        context: dict
    ) -> dict:
        """Create task for human evaluator"""

        return {
            'id': self._generate_id(),
            'context': context,
            'output': agent_output,
            'questions': [
                {
                    'q': 'Is the output correct?',
                    'type': 'boolean'
                },
                {
                    'q': 'Is the output helpful?',
                    'type': 'scale',
                    'range': (1, 5)
                },
                {
                    'q': 'Is the output well-formatted?',
                    'type': 'boolean'
                },
                {
                    'q': 'Any issues or concerns?',
                    'type': 'text'
                }
            ]
        }

    def collect_evaluation(
        self,
        task_id: str,
        responses: dict
    ):
        """Collect human evaluation response"""
        self.evaluations.append({
            'task_id': task_id,
            'responses': responses,
            'timestamp': time.time()
        })

    def analyze_human_feedback(self) -> dict:
        """Analyze collected human evaluations"""
        # Aggregate metrics
        # Identify patterns
        # Generate insights
        pass
```

## Continuous Evaluation

### Monitoring in Production

```python
class AgentMonitor:
    """Monitor agent performance in production"""

    def __init__(self):
        self.metrics = {
            'success_rate': RollingAverage(window=100),
            'avg_steps': RollingAverage(window=100),
            'avg_cost': RollingAverage(window=100),
            'error_rate': RollingAverage(window=100)
        }
        self.alerts = []

    def record_execution(self, execution_data: dict):
        """Record agent execution"""

        self.metrics['success_rate'].add(
            1 if execution_data['success'] else 0
        )
        self.metrics['avg_steps'].add(execution_data['steps'])
        self.metrics['avg_cost'].add(execution_data['cost'])
        self.metrics['error_rate'].add(
            1 if execution_data.get('error') else 0
        )

        # Check for alerts
        self._check_alerts()

    def _check_alerts(self):
        """Check if metrics exceed thresholds"""

        if self.metrics['success_rate'].value() < 0.8:
            self.alerts.append({
                'type': 'low_success_rate',
                'value': self.metrics['success_rate'].value(),
                'threshold': 0.8,
                'timestamp': time.time()
            })

        if self.metrics['error_rate'].value() > 0.1:
            self.alerts.append({
                'type': 'high_error_rate',
                'value': self.metrics['error_rate'].value(),
                'threshold': 0.1,
                'timestamp': time.time()
            })

    def get_dashboard_data(self) -> dict:
        """Get current metrics for dashboard"""
        return {
            metric_name: metric.value()
            for metric_name, metric in self.metrics.items()
        }
```

### A/B Testing

```python
class ABTest:
    """A/B test agent versions"""

    def __init__(self, agent_a: Agent, agent_b: Agent):
        self.agent_a = agent_a
        self.agent_b = agent_b
        self.results_a = []
        self.results_b = []

    def run_test(self, tasks: List[str], traffic_split: float = 0.5):
        """Run A/B test"""

        for task in tasks:
            # Randomly assign to A or B
            use_a = random.random() < traffic_split

            if use_a:
                result = self.agent_a.run(task)
                self.results_a.append(result)
            else:
                result = self.agent_b.run(task)
                self.results_b.append(result)

    def analyze_results(self) -> dict:
        """Analyze A/B test results"""

        return {
            'agent_a': {
                'success_rate': self._calculate_success_rate(self.results_a),
                'avg_cost': self._calculate_avg_cost(self.results_a),
                'sample_size': len(self.results_a)
            },
            'agent_b': {
                'success_rate': self._calculate_success_rate(self.results_b),
                'avg_cost': self._calculate_avg_cost(self.results_b),
                'sample_size': len(self.results_b)
            },
            'statistical_significance': self._test_significance(),
            'recommendation': self._make_recommendation()
        }
```

## Best Practices

1. **Diverse Test Cases**: Cover edge cases, typical cases, and failure scenarios
2. **Automated Testing**: Run tests on every agent change
3. **Human Evaluation**: Supplement automated metrics with human judgment
4. **Monitoring**: Track performance in production continuously
5. **Versioning**: Track which agent version produced which results
6. **Reproducibility**: Use fixed random seeds and log all parameters
7. **Cost Tracking**: Monitor token usage and API costs
8. **Regression Testing**: Ensure new versions don't break existing functionality

## Next Steps

- Study **security and safety** considerations for agents
- Learn about **optimization techniques** based on evaluation results
- Explore **deployment strategies** for production agents
- Understand **debugging techniques** for agent failures
