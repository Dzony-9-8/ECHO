📁 PHASE 1 – PROJECT STRUCTURE



Create this structure exactly:



ai-orchestrator/

├── main.py

├── planner/

│   └── planner\_llama.py

├── router/

│   └── task\_router.py

├── models/

│   └── deepseek\_r1.py

├── synthesis/

│   └── output\_merger.py

└── requirements.txt

📦 requirements.txt

llama-cpp-python

pydantic



(You can add CUDA-enabled llama.cpp later.)



🧠 planner/planner\_llama.py



Central Planner – outputs JSON only



from pydantic import BaseModel

import json



class Plan(BaseModel):

&nbsp;   task: str

&nbsp;   reasoning\_required: bool

&nbsp;   models: list\[str]

&nbsp;   output\_style: str





PLANNER\_SYSTEM\_PROMPT = """

You are a central AI planner.

You do not solve tasks directly unless trivial.



Your job:

\- identify user intent

\- decide if deep reasoning is required

\- select the correct specialist models

\- output ONLY valid JSON



Available models:

\- deepseek\_r1 (reasoning)



Output JSON schema:

{

&nbsp; "task": string,

&nbsp; "reasoning\_required": boolean,

&nbsp; "models": \[string],

&nbsp; "output\_style": "concise" | "normal" | "detailed"

}

"""





class Planner:

&nbsp;   def \_\_init\_\_(self, llama\_model):

&nbsp;       self.model = llama\_model



&nbsp;   def plan(self, user\_input: str) -> Plan:

&nbsp;       prompt = f"""

{PLANNER\_SYSTEM\_PROMPT}



User input:

{user\_input}

"""



&nbsp;       raw = self.model(prompt, max\_tokens=256)

&nbsp;       text = raw\["choices"]\[0]\["text"]



&nbsp;       try:

&nbsp;           data = json.loads(text)

&nbsp;           return Plan(\*\*data)

&nbsp;       except Exception as e:

&nbsp;           raise RuntimeError(f"Planner JSON parse failed: {text}") from e

🧠 models/deepseek\_r1.py



Reasoning Specialist (NO user-facing output)



class DeepSeekR1:

&nbsp;   def \_\_init\_\_(self, llama\_model):

&nbsp;       self.model = llama\_model



&nbsp;   def run(self, task: str) -> str:

&nbsp;       prompt = f"""

You are a reasoning engine.

Solve the task step by step.

Do NOT address the user.



Task:

{task}

"""

&nbsp;       result = self.model(prompt, max\_tokens=512)

&nbsp;       return result\["choices"]\[0]\["text"].strip()

🔀 router/task\_router.py



Deterministic execution logic



class TaskRouter:

&nbsp;   def \_\_init\_\_(self, reasoning\_model):

&nbsp;       self.reasoning\_model = reasoning\_model



&nbsp;   def execute(self, plan, user\_input: str) -> dict:

&nbsp;       results = {}



&nbsp;       if plan.reasoning\_required and "deepseek\_r1" in plan.models:

&nbsp;           results\["reasoning"] = self.reasoning\_model.run(user\_input)



&nbsp;       return results

🧪 synthesis/output\_merger.py



Single voice output (very simple for Phase 1)



class OutputMerger:

&nbsp;   def merge(self, plan, model\_outputs: dict) -> str:

&nbsp;       if "reasoning" in model\_outputs:

&nbsp;           return model\_outputs\["reasoning"]



&nbsp;       return "No output generated."

🚀 main.py



Minimal working orchestration loop



from llama\_cpp import Llama



from planner.planner\_llama import Planner

from router.task\_router import TaskRouter

from models.deepseek\_r1 import DeepSeekR1

from synthesis.output\_merger import OutputMerger





def load\_llama(path):

&nbsp;   return Llama(

&nbsp;       model\_path=path,

&nbsp;       n\_ctx=4096,

&nbsp;       n\_threads=8,

&nbsp;       n\_gpu\_layers=20

&nbsp;   )





def main():

&nbsp;   # Load models (replace paths with your GGUF files)

&nbsp;   planner\_llama = load\_llama("models/llama-3.1-8b.gguf")

&nbsp;   reasoning\_llama = load\_llama("models/deepseek-r1.gguf")



&nbsp;   planner = Planner(planner\_llama)

&nbsp;   reasoning = DeepSeekR1(reasoning\_llama)

&nbsp;   router = TaskRouter(reasoning)

&nbsp;   merger = OutputMerger()



&nbsp;   print("Local AI Orchestrator (Phase 1)")

&nbsp;   print("Type 'exit' to quit.\\n")



&nbsp;   while True:

&nbsp;       user\_input = input("You: ")

&nbsp;       if user\_input.lower() == "exit":

&nbsp;           break



&nbsp;       plan = planner.plan(user\_input)

&nbsp;       outputs = router.execute(plan, user\_input)

&nbsp;       final\_answer = merger.merge(plan, outputs)



&nbsp;       print("\\nAI:", final\_answer, "\\n")





if \_\_name\_\_ == "\_\_main\_\_":

&nbsp;   main()

