---
sidebar_position: 7
---

# Multi-Agent Systems

Multi-agent systems involve multiple AI agents working together to solve complex problems. Each agent can have specialized roles, capabilities, and knowledge.

## Why Multi-Agent Systems?

### Advantages

1. **Specialization**: Each agent can excel at specific tasks
2. **Scalability**: Distribute work across multiple agents
3. **Robustness**: System continues if one agent fails
4. **Modularity**: Easier to develop and maintain
5. **Parallelization**: Multiple agents can work simultaneously

### When to Use Multi-Agent

- Task requires diverse expertise
- Problem naturally decomposes into sub-problems
- Need for checks and balances (e.g., one agent reviews another's work)
- Simulating organizational workflows
- Scaling beyond single-agent capabilities

## Architecture Patterns

### 1. Hierarchical (Manager-Worker)

```
         Manager Agent
               |
    +----------+----------+
    |          |          |
 Worker 1   Worker 2   Worker 3
```

**Implementation:**

```python
class ManagerAgent:
    """Coordinates worker agents"""

    def __init__(self, llm, workers: List[Agent]):
        self.llm = llm
        self.workers = {w.role: w for w in workers}

    def execute_task(self, task: str) -> dict:
        """Break down task and delegate to workers"""

        # Plan task decomposition
        plan = self._create_plan(task)

        results = {}

        # Assign subtasks to workers
        for step in plan:
            worker_role = step['assigned_to']
            subtask = step['task']

            print(f"Delegating to {worker_role}: {subtask}")

            # Execute subtask
            result = self.workers[worker_role].run(subtask)
            results[step['id']] = result

            # Check quality
            if not self._validate_result(result):
                # Reassign or request revision
                result = self._handle_failure(step, result)

        # Synthesize final result
        final_result = self._synthesize(results)
        return final_result

    def _create_plan(self, task: str) -> List[dict]:
        """Decompose task into subtasks"""
        prompt = f"""
Break down this task into subtasks and assign to workers:

Task: {task}

Available workers:
{self._format_workers()}

For each subtask, specify:
1. Subtask description
2. Which worker should handle it
3. Dependencies on other subtasks
4. Success criteria

Output as structured plan.
"""
        response = self.llm.generate(prompt)
        return self._parse_plan(response)

    def _format_workers(self) -> str:
        """Describe available workers"""
        return "\n".join([
            f"- {role}: {agent.description}"
            for role, agent in self.workers.items()
        ])


class WorkerAgent:
    """Specialized agent for specific tasks"""

    def __init__(self, role: str, expertise: str, llm, tools):
        self.role = role
        self.expertise = expertise
        self.llm = llm
        self.tools = tools

    def run(self, task: str) -> dict:
        """Execute assigned task"""
        prompt = f"""
You are a {self.role} with expertise in {self.expertise}.

Task: {task}

Use your specialized knowledge and tools to complete this task.
"""
        # Execute task using tools
        result = self._execute_with_tools(prompt)
        return result


# Usage Example
manager = ManagerAgent(
    llm=llm,
    workers=[
        WorkerAgent("Researcher", "Information gathering", llm, research_tools),
        WorkerAgent("Analyst", "Data analysis", llm, analysis_tools),
        WorkerAgent("Writer", "Content creation", llm, writing_tools)
    ]
)

result = manager.execute_task(
    "Create a market analysis report for electric vehicles"
)
```

### 2. Peer-to-Peer (Collaborative)

Agents communicate as equals, collaborating to solve problems.

```python
class CollaborativeAgent:
    """Agent that collaborates with peers"""

    def __init__(self, name: str, expertise: str, llm, tools):
        self.name = name
        self.expertise = expertise
        self.llm = llm
        self.tools = tools
        self.peers = []
        self.shared_context = {}

    def add_peer(self, agent):
        """Add a peer agent"""
        self.peers.append(agent)

    def collaborate(self, task: str) -> dict:
        """Work with peers to solve task"""

        # Share initial thoughts
        my_approach = self._propose_approach(task)
        self._share_with_peers("approach", my_approach)

        # Gather peer input
        peer_approaches = self._gather_peer_input("approach")

        # Synthesize best approach
        final_approach = self._synthesize_approaches(
            my_approach,
            peer_approaches
        )

        # Execute collaboratively
        result = self._execute_collaborative(task, final_approach)

        return result

    def _share_with_peers(self, message_type: str, content: any):
        """Share information with peers"""
        for peer in self.peers:
            peer.receive_message(self.name, message_type, content)

    def receive_message(self, sender: str, message_type: str, content: any):
        """Receive message from peer"""
        if message_type not in self.shared_context:
            self.shared_context[message_type] = {}
        self.shared_context[message_type][sender] = content

    def _gather_peer_input(self, message_type: str) -> dict:
        """Get all peer inputs of a certain type"""
        return self.shared_context.get(message_type, {})


# Usage
agent_a = CollaborativeAgent("Alice", "Backend Dev", llm, backend_tools)
agent_b = CollaborativeAgent("Bob", "Frontend Dev", llm, frontend_tools)
agent_c = CollaborativeAgent("Carol", "DevOps", llm, devops_tools)

# Connect agents
agent_a.add_peer(agent_b)
agent_a.add_peer(agent_c)
agent_b.add_peer(agent_a)
agent_b.add_peer(agent_c)
agent_c.add_peer(agent_a)
agent_c.add_peer(agent_b)

# Collaborate
result = agent_a.collaborate("Build and deploy a new feature")
```

### 3. Pipeline (Sequential)

Each agent processes the output of the previous agent.

```python
class PipelineSystem:
    """Sequential processing by multiple agents"""

    def __init__(self, agents: List[Agent]):
        self.agents = agents

    def execute(self, initial_input: str) -> dict:
        """Process input through agent pipeline"""

        current_input = initial_input
        history = []

        for i, agent in enumerate(self.agents):
            print(f"Stage {i+1}: {agent.name}")

            # Agent processes current input
            result = agent.run(current_input)

            history.append({
                'agent': agent.name,
                'input': current_input,
                'output': result
            })

            # Output becomes next agent's input
            current_input = result

        return {
            'final_output': current_input,
            'history': history
        }


# Example: Content Creation Pipeline
pipeline = PipelineSystem([
    Agent("Outliner", "Create article outline", llm, tools),
    Agent("Writer", "Write article content", llm, tools),
    Agent("Editor", "Edit and improve writing", llm, tools),
    Agent("Fact-Checker", "Verify facts and claims", llm, tools),
    Agent("Formatter", "Format for publication", llm, tools)
])

result = pipeline.execute("Write article about renewable energy")
```

### 4. Debate/Consensus

Agents debate different perspectives to reach a conclusion.

```python
class DebateSystem:
    """Agents debate to reach consensus"""

    def __init__(self, agents: List[Agent], max_rounds: int = 3):
        self.agents = agents
        self.max_rounds = max_rounds

    def debate(self, question: str) -> dict:
        """Facilitate debate among agents"""

        positions = {}
        debate_history = []

        # Round 1: Initial positions
        for agent in self.agents:
            position = agent.run(f"What is your position on: {question}")
            positions[agent.name] = position
            debate_history.append({
                'round': 1,
                'agent': agent.name,
                'position': position
            })

        # Subsequent rounds: Respond to other positions
        for round_num in range(2, self.max_rounds + 1):
            new_positions = {}

            for agent in self.agents:
                # Show agent other positions
                other_positions = {
                    name: pos
                    for name, pos in positions.items()
                    if name != agent.name
                }

                prompt = f"""
Question: {question}

Your previous position:
{positions[agent.name]}

Other agents' positions:
{self._format_positions(other_positions)}

Respond to the other positions. Do you maintain your position,
modify it, or change your mind? Explain your reasoning.
"""
                response = agent.run(prompt)
                new_positions[agent.name] = response

                debate_history.append({
                    'round': round_num,
                    'agent': agent.name,
                    'position': response
                })

            positions = new_positions

            # Check for consensus
            if self._check_consensus(positions):
                break

        # Synthesize final answer
        final_answer = self._synthesize_consensus(positions)

        return {
            'answer': final_answer,
            'debate_history': debate_history,
            'individual_positions': positions
        }

    def _check_consensus(self, positions: dict) -> bool:
        """Check if agents have reached consensus"""
        # Simple implementation: check if all positions are similar
        position_texts = list(positions.values())
        # Compare similarity of positions
        return self._all_similar(position_texts)


# Usage: Debate different approaches
debate_system = DebateSystem([
    Agent("Pragmatist", "Focus on practical solutions", llm, tools),
    Agent("Idealist", "Focus on best practices", llm, tools),
    Agent("Skeptic", "Challenge assumptions", llm, tools)
])

result = debate_system.debate(
    "Should we use microservices or monolithic architecture?"
)
```

### 5. Auction-Based

Agents bid on tasks based on their capability and availability.

```python
class AuctionBasedSystem:
    """Agents bid on tasks"""

    def __init__(self, agents: List[Agent]):
        self.agents = agents

    def assign_task(self, task: str) -> Agent:
        """Auction task to most suitable agent"""

        bids = {}

        # Collect bids from agents
        for agent in self.agents:
            bid = agent.bid_on_task(task)
            bids[agent.name] = {
                'agent': agent,
                'bid': bid
            }

        # Select winner (highest bid/best match)
        winner = max(bids.values(), key=lambda x: x['bid']['score'])

        return winner['agent']

    def execute_task(self, task: str) -> dict:
        """Assign and execute task"""
        assigned_agent = self.assign_task(task)
        result = assigned_agent.run(task)
        return {
            'assigned_to': assigned_agent.name,
            'result': result
        }


class BiddingAgent(Agent):
    """Agent that can bid on tasks"""

    def bid_on_task(self, task: str) -> dict:
        """Evaluate task and submit bid"""

        prompt = f"""
Task: {task}

Evaluate your suitability for this task:
1. How well does it match your expertise?
2. Do you have the necessary tools?
3. What is your current workload?
4. How confident are you in completing it successfully?

Provide a score from 0-100.
"""

        response = self.llm.generate(prompt)
        score = self._parse_score(response)

        return {
            'score': score,
            'reasoning': response,
            'estimated_time': self._estimate_time(task)
        }
```

## Communication Protocols

### Message Passing

```python
class AgentMessage:
    """Standard message format for agent communication"""

    def __init__(
        self,
        sender: str,
        recipient: str,
        message_type: str,
        content: any,
        metadata: dict = None
    ):
        self.sender = sender
        self.recipient = recipient
        self.message_type = message_type
        self.content = content
        self.metadata = metadata or {}
        self.timestamp = time.time()


class MessageBus:
    """Central message routing for agents"""

    def __init__(self):
        self.agents = {}
        self.message_queue = queue.Queue()

    def register_agent(self, agent_id: str, agent):
        """Register agent with message bus"""
        self.agents[agent_id] = agent

    def send_message(self, message: AgentMessage):
        """Send message to recipient"""
        self.message_queue.put(message)

    def broadcast(self, sender: str, message_type: str, content: any):
        """Broadcast message to all agents"""
        for agent_id in self.agents:
            if agent_id != sender:
                msg = AgentMessage(sender, agent_id, message_type, content)
                self.send_message(msg)

    def process_messages(self):
        """Deliver queued messages"""
        while not self.message_queue.empty():
            message = self.message_queue.get()
            recipient = self.agents.get(message.recipient)
            if recipient:
                recipient.receive_message(message)
```

### Shared Memory

```python
class SharedMemory:
    """Shared knowledge base for multiple agents"""

    def __init__(self):
        self.knowledge = {}
        self.locks = {}

    def write(self, key: str, value: any, agent_id: str):
        """Write to shared memory"""
        if key not in self.knowledge:
            self.knowledge[key] = []

        self.knowledge[key].append({
            'value': value,
            'author': agent_id,
            'timestamp': time.time()
        })

    def read(self, key: str) -> List[dict]:
        """Read from shared memory"""
        return self.knowledge.get(key, [])

    def get_latest(self, key: str) -> any:
        """Get most recent value"""
        entries = self.knowledge.get(key, [])
        if entries:
            return entries[-1]['value']
        return None

    def lock(self, key: str, agent_id: str) -> bool:
        """Acquire lock for exclusive access"""
        if key not in self.locks or self.locks[key] is None:
            self.locks[key] = agent_id
            return True
        return False

    def unlock(self, key: str, agent_id: str):
        """Release lock"""
        if self.locks.get(key) == agent_id:
            self.locks[key] = None
```

## Coordination Strategies

### 1. Centralized Coordination

```python
class Coordinator:
    """Central coordinator for multi-agent system"""

    def __init__(self, agents: List[Agent]):
        self.agents = {a.name: a for a in agents}
        self.task_queue = []
        self.results = {}

    def coordinate(self, goal: str):
        """Coordinate agents to achieve goal"""

        # Decompose goal into tasks
        tasks = self._decompose_goal(goal)

        # Build dependency graph
        dependency_graph = self._build_dependencies(tasks)

        # Execute tasks in order
        while tasks:
            # Find tasks with no dependencies
            ready_tasks = self._get_ready_tasks(tasks, dependency_graph)

            # Assign to agents (potentially in parallel)
            assignments = self._assign_tasks(ready_tasks)

            # Execute
            results = self._execute_assignments(assignments)

            # Update state
            self._update_results(results)
            tasks = self._remove_completed(tasks, results)
            dependency_graph = self._update_dependencies(
                dependency_graph,
                results
            )

        return self._synthesize_results()
```

### 2. Decentralized Coordination

```python
class DecentralizedAgent(Agent):
    """Agent with autonomous decision-making"""

    def __init__(self, name: str, llm, tools):
        super().__init__(name, llm, tools)
        self.peers = []
        self.current_goal = None
        self.commitment = None

    def coordinate_with_peers(self, goal: str):
        """Coordinate without central authority"""

        # Announce intention
        self._announce_to_peers("intention", {
            'goal': goal,
            'proposed_action': self._propose_action(goal)
        })

        # Gather peer intentions
        peer_intentions = self._wait_for_peer_announcements()

        # Negotiate and avoid conflicts
        final_plan = self._negotiate_plan(peer_intentions)

        # Commit to action
        self.commitment = final_plan[self.name]
        self._announce_to_peers("commitment", self.commitment)

        # Execute
        result = self._execute(self.commitment)

        # Share result
        self._announce_to_peers("result", result)

        return result
```

## Error Handling and Fault Tolerance

```python
class RobustMultiAgentSystem:
    """Multi-agent system with fault tolerance"""

    def __init__(self, agents: List[Agent]):
        self.agents = agents
        self.agent_health = {a.name: "healthy" for a in agents}

    def execute_with_fallback(self, task: str):
        """Execute task with automatic failover"""

        # Try agents in priority order
        for agent in self.agents:
            if self.agent_health[agent.name] != "healthy":
                continue

            try:
                result = self._execute_with_timeout(agent, task, timeout=60)

                if self._validate_result(result):
                    return result
                else:
                    # Result invalid, try next agent
                    continue

            except TimeoutError:
                self.agent_health[agent.name] = "unhealthy"
                self._log_failure(agent.name, "timeout")

            except Exception as e:
                self.agent_health[agent.name] = "unhealthy"
                self._log_failure(agent.name, str(e))

        # All agents failed
        raise RuntimeError("All agents failed to complete task")

    def monitor_and_heal(self):
        """Monitor agent health and attempt recovery"""
        for agent_name, status in self.agent_health.items():
            if status == "unhealthy":
                if self._attempt_recovery(agent_name):
                    self.agent_health[agent_name] = "healthy"
```

## Best Practices

### 1. Clear Role Definition

```python
# Define each agent's responsibilities clearly
researcher_agent = Agent(
    name="Researcher",
    role="Information Gathering",
    expertise=[
        "Web search",
        "Document analysis",
        "Source verification"
    ],
    responsibilities=[
        "Find relevant information",
        "Cite sources",
        "Assess credibility"
    ],
    constraints=[
        "Only use reliable sources",
        "Must provide citations"
    ]
)
```

### 2. Efficient Communication

```python
# Use structured messages
class StructuredMessage:
    def __init__(self, intent: str, data: dict):
        self.intent = intent  # "request", "inform", "query", etc.
        self.data = data

    def to_prompt(self) -> str:
        """Convert to natural language for LLM"""
        if self.intent == "request":
            return f"Please {self.data['action']}: {self.data['details']}"
        elif self.intent == "inform":
            return f"FYI: {self.data['information']}"
        # ...
```

### 3. Conflict Resolution

```python
def resolve_conflicts(agent_outputs: List[dict]) -> dict:
    """Handle conflicting outputs from multiple agents"""

    # Strategy 1: Voting
    if all(isinstance(o, bool) for o in agent_outputs):
        return majority_vote(agent_outputs)

    # Strategy 2: Weighted by confidence
    if all('confidence' in o for o in agent_outputs):
        return weighted_average(agent_outputs)

    # Strategy 3: Escalate to meta-agent
    return meta_agent_resolve(agent_outputs)
```

## Next Steps

- Learn about **agent evaluation** in multi-agent settings
- Study **security considerations** for multi-agent systems
- Explore **scalability patterns** for large agent teams
- Understand **cost optimization** strategies
