const mainOutput = document.getElementById('main-output');
const textarea = document.getElementById('main-output');

const executionStatus = {
	Image: document.getElementById('execution-status-img'),
	Text: document.getElementById('execution-status')
};

function updateExecutionStatus(status)
{
	switch(status)
	{
		case -2: // preload
			executionStatus.Image.hidden = true;
			executionStatus.Image.src = './res/stopped.png';
			executionStatus.Image.src = './res/loading.png';
			executionStatus.Image.src = './res/finished.png';
			executionStatus.Image.src = './res/idle.png';
			executionStatus.Image.hidden = false;
		break;
		
		case -1: // forced
			executionStatus.Text.innerText = "Forced stop. ";
			executionStatus.Text.style.color = "#cd7272";
			executionStatus.Image.src = './res/stopped.png';
			executionStatus.Image.className = "";
		break;
		
		case 0: // not running
			executionStatus.Text.innerText = "Not running. ";
			executionStatus.Text.style.color = "#7277cd";
			executionStatus.Image.src = './res/idle.png';
			executionStatus.Image.className = "";
		break;
		
		case 1: // running
			executionStatus.Text.innerText = "Running... ";
			executionStatus.Text.style.color = "#7277cd";
			executionStatus.Image.src = './res/loading.png';
			executionStatus.Image.className = "rotating";
		break;
		
		case 2: // finished
			executionStatus.Text.innerText = "Finished. ";
			executionStatus.Text.style.color = "#81cd72";
			executionStatus.Image.src = './res/finished.png';
			executionStatus.Image.className = "";
		break;
	}
}

updateExecutionStatus(-2); // preload

/*
function KS_HelpButton() 
{
	let x = document.getElementById("win-draggable-help-modal");
	if (x.style.display === "none") {
		x.style.display = "block";
	} else {
		x.style.display = "none";
	}
}
*/
function AppendOutput(data)
{
	// Nodes are cool but slow :(
	mainOutput.value += data;
	mainOutput.value = mainOutput.value.slice(-2015);
	mainOutput.value = mainOutput.value.split('\n').slice(-32).join('\n');
	// [NODES] mainOutput.append(data);
	// [NODES] if (mainOutput.childNodes.length >= 600) mainOutput.childNodes[0].remove();
	textarea.scrollTop = textarea.scrollHeight;
}

function FlushOutput()
{
	// [NODES] mainOutput.innerHTML = '';
	mainOutput.value = "";
	textarea.scrollTop = textarea.scrollHeight;
}

function RaiseError(err)
{
	// [NODES] mainOutput.innerHTML = '';
	// [NODES] mainOutput.append(err);
	mainOutput.value = err;
	// mainOutput.value = mainOutput.value.split('\n').slice(-100).join('\n');
	textarea.scrollTop = textarea.scrollHeight;
	compil_forceStop = true;
}

async function KS_RunScript()
{
	updateExecutionStatus(1); // running
	RestartShell();
	
	let sourceCode = document.getElementById('main-input').value;
	
	let lines = sourceCode.split('\n');
	
	FlushOutput();
	
	// Prepare state:
	
	for (let i = 0; i < lines.length; i++)
	{
		
		let line = lines[i];
		let words = line.split(/[\t ]+/g);
		
		if (words.length >= 1)
		{
			if (words[0].startsWith(':')) 
			{
				let name = words[0].split(':')[1];
				
				if (name == null) RaiseError(`[ERROR] Jump label name was not set.`);
				else 
				{
					if (prog_LocalJumpLabels[name] != null) RaiseError(`[ERROR] Jump label named "${name}" name was already set.`);
					else 
					{
						prog_LocalJumpLabels[name] = i;
					}
				}
			}
			
			if (words[0].startsWith('new'))
			{
				compil_scriptCommands[words[0]](words);
			}
			else if (words[0].startsWith('get'))
			{
				if (prog_LocalVariables[words[1]] == null) RaiseError(`[ERROR] Couldn't GET variable "${words[1]}" because it doesn't exists.`);
				else if (words[2] == null) RaiseError(`[ERROR] Couldn't GET variable, missing two parameters.\nUssage: get [VARIABLE] [NAME] [VALUE].`);
				else if (words[3] == null) RaiseError(`[ERROR] Couldn't GET variable, missing one parameter.\nUssage: get [VARIABLE] [NAME] [VALUE].`);
				else if (words[2] == 'sys_input')
				{
					sys_HookInput(words[3]);
				}
			}
		}
	}
	
	// Execution state:
	
	let sleepExecutionKeeper = 0;
	
	for (compil_executionLine = 0; compil_executionLine < lines.length; compil_executionLine++)
	{
		sleepExecutionKeeper++;
		if (sleepExecutionKeeper >= 100) 
		{
			await new Promise(resolve => setTimeout(resolve, 1));
			sleepExecutionKeeper = 0;
		}
		
		if (compil_forceStop) 
		{
			// compil_executionLine = lines.length;
			return;
		}
		
		compil_currentLine = lines[compil_executionLine];
		let words = compil_currentLine.split(/[\t ]+/g);
		
		if (words.length >= 1)
		{
			if (words[0].startsWith(';') || words[0].startsWith(':') || words[0].startsWith('new') || !words[0].trim()) continue;
			else if (compil_scriptCommands[words[0]] == null) RaiseError(`[ERROR] Instruction "${words[0]}" is unknown.`);
			else
			{
				// RaiseError(`[WARN] Should be calling ${words[0]}`);
				compil_scriptCommands[words[0]](words);
			}
		}
		
	}
	
	// End of interpreting:
	sys_UnhookInput();
	updateExecutionStatus(2); // finished 
}

let compil_currentLine = null;
let compil_executionLine = null;
let compil_scriptCommands = null;
let compil_defaultVariableTypes = null;
let prog_LocalVariables = null;
let prog_LocalJumpLabels = null;
let prog_LocalStack = null;
let prog_WebSocket = null;
let prog_WebSocket_messages = null;

let compil_forceStop = false;

function KS_ForceStop() 
{
	RestartShell();
	compil_forceStop = true;
	sys_UnhookInput();
	updateExecutionStatus(-1); // forced stop 
}

function RestartShell()
{
	compil_forceStop = false;
	compil_executionLine = 0;
	prog_LocalVariables = {};
	prog_LocalJumpLabels = {};
	prog_LocalJumpEnds = {};
	prog_LocalStack = [];
	prog_WebSocket = null;
	prog_WebSocket_messages = [];
	
	compil_defaultVariableTypes = 
	{
		"int": 0, "bool": false, "string": ""
	};
	compil_scriptCommands = 
	{
		"new": prog_NEW, "set": prog_SET, "jmp": prog_JMP, "end": prog_END, "out": prog_OUT, 
		"cpy": prog_CPY, "add": prog_ADD, "sub": prog_SUB, "siz": prog_SIZ, "sin": prog_SIN, 
		"flp": prog_FLP, "tof": prog_TOF, "len": prog_LEN, "put": prog_PUT, "cut": prog_CUT,
		"get": prog_GET, "psh": prog_PSH, "pop": prog_POP, "mul": prog_MUL, "div": prog_DIV,
		"mod": prog_MOD, "clr": prog_CLR, "cst": prog_CST, "wsc": prog_WSC, "wsp": prog_WSP,
		"wsi": prog_WSI, "wsr": prog_WSR, "wss": prog_WSS, "wse": prog_WSE,
		
		
		"jmp!": prog_JMP_END, "out!": prog_OUT_NL, "siz!": prog_SIZ_NOT, "sin!": prog_SIN_NOT,
		"end!": prog_END_EP
	};
}

function prog_NEW(array)
{
	let name = array[1];
	let type = array[2];
	
	if (prog_LocalVariables[name] != null) RaiseError(`[ERROR] Couldn't create variable "${name}" because it already exists.`);
	else 
	{
		if (compil_defaultVariableTypes[type] == null) RaiseError(`[ERROR] Couldn't create variable "${name}" because its type ("${type}") is invalid.`);
		else
		{
			prog_LocalVariables[name] = compil_defaultVariableTypes[type];
		}
	}
}

function prog_SET(array)
{
	let name = array[1];
	let value = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't SET variable "${name}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "boolean":
				if (value) value = true;
				else if (!value) value = false;
				else RaiseError(`[ERROR] Couldn't SET variable "${name}" to "${value}" because it's value type (${typeof prog_LocalVariables[name]} =/= ${typeof value}) doesn't match.`);
			break;
			
			case "number":
				if (!isNaN(value)) prog_LocalVariables[name] = parseInt(value);
				else RaiseError(`[ERROR] Couldn't SET variable "${name}" to "${value}" because it's value type (${typeof prog_LocalVariables[name]} =/= ${typeof value}) doesn't match.`);
			break;
			
			case "string":
				if (compil_currentLine.match(/(')((?:\\\1|(?:(?!\1).))*)\1/g) != null)
				{
					let matched =  compil_currentLine.match(/(')((?:\\\1|(?:(?!\1).))*)\1/g)[0].toString();
					prog_LocalVariables[name] = matched.substring(1, matched.length - 1);
				}
				else RaiseError(`[ERROR] Couldn't SET variable "${name}" because value's format is invalid. \nUssage: set [VARIABLE] '[VALUE]'`);
			break;
		}
	}
}

function prog_CPY(array)
{
	let name = array[1];
	let name2 = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't CPY variable "${name}" because it doesn't exists.`);
	else if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't CPY variable "${name2}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "boolean":
				if (prog_LocalVariables[name2]) prog_LocalVariables[name] = true;
				else if (!prog_LocalVariables[name2]) prog_LocalVariables[name] = false;
				else RaiseError(`[ERROR] Couldn't SET variable "${name}" to "${prog_LocalVariables[name2]}" because it's value type (${typeof prog_LocalVariables[name]} =/= ${typeof prog_LocalVariables[name2]}) doesn't match.`);
			break;
			
			case "number":
				if (!isNaN(prog_LocalVariables[name2]) && prog_LocalVariables[name2].toString() !== "") {
					prog_LocalVariables[name] = prog_LocalVariables[name2];
				}else RaiseError(`[ERROR] Couldn't CPY variable "${name2}" to "${name}" because it's value type (${typeof prog_LocalVariables[name]} =/= ${typeof prog_LocalVariables[name2]}) doesn't match.`);
			break;
			
			case "string":
				prog_LocalVariables[name] = prog_LocalVariables[name2].toString();
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't CPY variable "${name}" because it's type is unknown.`);
			break;
		}
	}
}

function prog_ADD(array)
{
	let name = array[1];
	let name2 = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't ADD variable "${name}" because it doesn't exists.`);
	else if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't ADD variable "${name2}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "number":
				if (!isNaN(prog_LocalVariables[name2])) prog_LocalVariables[name] += parseInt(prog_LocalVariables[name2]);
				else RaiseError(`[ERROR] Couldn't ADD variable "${name}" with "${name2}" because it's value type (${typeof prog_LocalVariables[name]} =/= ${typeof prog_LocalVariables[name2]}) doesn't match.`);
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't ADD variable "${name}" because it's type isn't a number.`);
			break;
		}
	}
}

function prog_SUB(array)
{
	let name = array[1];
	let name2 = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't SUB variable "${name}" because it doesn't exists.`);
	else if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't SUB variable "${name2}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "number":
				if (!isNaN(prog_LocalVariables[name2])) prog_LocalVariables[name] -= parseInt(prog_LocalVariables[name2]);
				else RaiseError(`[ERROR] Couldn't SUB variable "${name}" with "${name2}" because it's value type (${typeof prog_LocalVariables[name]} =/= ${typeof prog_LocalVariables[name2]}) doesn't match.`);
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't SUB variable "${name}" because it's type isn't a number.`);
			break;
		}
	}
}

function prog_JMP(array)
{
	let name = array[1];
	
	if (prog_LocalJumpLabels[name] == null) RaiseError(`[ERROR] Couldn't JMP to label "${name}" because it doesn't exists.`);
	else 
	{
		compil_executionLine = prog_LocalJumpLabels[name];
	}
}

let prog_LocalJumpEnds = null;
let prog_jumpsEnded = 0;

function prog_JMP_END(array)
{
	let name = array[1];
	
	if (prog_LocalJumpLabels[name] == null) RaiseError(`[ERROR] Couldn't JMP to label "${name}" because it doesn't exists.`);
	else 
	{
		prog_jumpsEnded++;
		prog_LocalJumpEnds[prog_jumpsEnded] = compil_executionLine;
		compil_executionLine = prog_LocalJumpLabels[name];
	}
}

function prog_END(array)
{
	if (prog_jumpsEnded != 0)
	{
		compil_executionLine = prog_LocalJumpEnds[prog_jumpsEnded];
		
		delete prog_LocalJumpEnds[prog_jumpsEnded];
		prog_jumpsEnded--;
	}
}

function prog_END_EP(array)
{
	compil_forceStop = true;
}

function prog_OUT(array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't OUT variable "${name}" because it doesn't exists.`);
	else 
	{
		AppendOutput(prog_LocalVariables[name]);
	}
}

function prog_OUT_NL(array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't OUT! variable "${name}" because it doesn't exists.`);
	else 
	{
		AppendOutput(prog_LocalVariables[name] + "\n");
	}
}

function prog_SIZ(array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't SIZ variable "${name}" because it doesn't exists.`);
	else 
	{
		if (!prog_LocalVariables[name])
		{
			compil_executionLine += 1;
		}
	}
}

function prog_SIZ_NOT(array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't SIZ! variable "${name}" because it doesn't exists.`);
	else 
	{
		if (prog_LocalVariables[name])
		{
			compil_executionLine += 1;
		}
	}
}

function prog_SIN(array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't SIN variable "${name}" because it doesn't exists.`);
	else 
	{
		if (typeof prog_LocalVariables[name] == "number" && prog_LocalVariables[name] < 0)
		{
			compil_executionLine += 1;
		}
	}
}

function prog_SIN_NOT(array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't SIN! variable "${name}" because it doesn't exists.`);
	else 
	{
		if (typeof prog_LocalVariables[name] == "number" && prog_LocalVariables[name] > 0)
		{
			compil_executionLine += 1;
		}
	}
}

function prog_FLP(array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't FLP variable "${name}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "number":
				prog_LocalVariables[name] *= -1;
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't FLP variable "${name}" because it's type isn't a number.`);
			break;
		}
	}
}

function prog_TOF(array)
{
	let name = array[1];
	let name2 = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't TOF variable "${name}" because it doesn't exists.`);
	else if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't TOF variable "${name2}" because it doesn't exists.`);
	else
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "string":
				prog_LocalVariables[name] = typeof prog_LocalVariables[name2];
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't TOF variable "${name}" because it's type isn't a string.`);
			break;
		}
	}
}

function prog_LEN(array)
{
	let name = array[1];
	let name2 = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't LEN variable "${name}" because it doesn't exists.`);
	else if (typeof prog_LocalVariables[name] != "number") RaiseError(`[ERROR] Couldn't LEN variable "${name}" because it's type isn't a number.`);
	else if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't LEN variable "${name2}" because it doesn't exists.`);
	else
	{
		switch (typeof prog_LocalVariables[name2])
		{
			case "string":
				prog_LocalVariables[name] = prog_LocalVariables[name2].length;
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't LEN variable "${name2}" because it's type isn't a string.`);
			break;
		}
	}
}

function prog_PUT(array)
{
	let name = array[1];
	let name2 = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't PUT variable "${name}" because it doesn't exists.`);
	else if (typeof prog_LocalVariables[name] != "string") RaiseError(`[ERROR] Couldn't PUT variable "${name}" because it's type isn't a string.`);
	else if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't PUT variable "${name2}" because it doesn't exists.`);
	else
	{
		prog_LocalVariables[name] += prog_LocalVariables[name2].toString();
	}
}

function prog_CUT(array)
{
	let name = array[1];
	let name2 = array[2];
	let name3 = array[3];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't CUT variable "${name}" because it doesn't exists.`);
	else if (typeof prog_LocalVariables[name] != "string") RaiseError(`[ERROR] Couldn't CUT variable "${name}" because it's type isn't a string.`);
	else if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't CUT variable "${name2}" because it doesn't exists.`);
	else if (typeof prog_LocalVariables[name2] != "number") RaiseError(`[ERROR] Couldn't CUT variable "${name2}" because it's type isn't a number.`);
	else if (prog_LocalVariables[name3] == null) RaiseError(`[ERROR] Couldn't CUT variable "${name3}" because it doesn't exists.`);
	else if (typeof prog_LocalVariables[name3] != "number") RaiseError(`[ERROR] Couldn't CUT variable "${name3}" because it's type isn't a number.`);
	else
	{
		prog_LocalVariables[name] = prog_LocalVariables[name].substring(prog_LocalVariables[name2], prog_LocalVariables[name3]);
	}
}

function prog_GET(array)
{
	let name = array[1];
	let name2 = array[2];
	let value = array[3];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't GET variable [${name2}] "${value}" to "${name}" because it doesn't exists.`);
	else if (typeof prog_LocalVariables[name] != "number") RaiseError(`[ERROR] Couldn't GET variable [${name2}] "${value}" to "${name}" because it's type isn't a number.`);
	else
	{
		if (name2 == 'sys_input') prog_LocalVariables[name] = sys_inputKeycodes[value];
		else if (name2 == 'sys_env')
		{
			if (value == null) RaiseError(`[ERROR] Couldn't GET variable [${name2}] "${value}" to "${name}" because getting value wasn't set.`);
			switch(value) 
			{
				case 'Random':
					prog_LocalVariables[name] = Math.floor(Math.random() * 1000);
				break;
				
				case 'Time':
					prog_LocalVariables[name] = parseInt(new Date().getTime() / 1000)
				break;
				
				case 'TimeMs':
					prog_LocalVariables[name] = new Date().getTime();;
				break;
			}
		}
	}
}

function prog_PSH(array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't PSH variable "${name}" because it doesn't exists.`);
	else 
	{
		prog_LocalStack.push(prog_LocalVariables[name]);
	}
}

function prog_POP(array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't POP to variable "${name}" because it doesn't exists.`);
	else if (prog_LocalStack.length < 1) RaiseError(`[ERROR] Couldn't POP to variable "${name}" because stack is empty.`);
	else 
	{
		prog_LocalVariables[name] = prog_LocalStack.pop();
	}
}

function prog_MUL(array)
{
	let name = array[1];
	let name2 = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't MUL variable "${name}" because it doesn't exists.`);
	else if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't MUL variable "${name2}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "number":
				if (!isNaN(prog_LocalVariables[name2])) prog_LocalVariables[name] *= parseInt(prog_LocalVariables[name2]);
				else RaiseError(`[ERROR] Couldn't MUL variable "${name}" with "${name2}" because it's value type (${typeof prog_LocalVariables[name]} =/= ${typeof prog_LocalVariables[name2]}) doesn't match.`);
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't MUL variable "${name}" because it's type isn't a number.`);
			break;
		}
	}
}

function prog_DIV(array)
{
	let name = array[1];
	let name2 = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't DIV variable "${name}" because it doesn't exists.`);
	else if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't DIV variable "${name2}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "number":
				if (!isNaN(prog_LocalVariables[name2])) prog_LocalVariables[name] = Math.floor(prog_LocalVariables[name] / parseInt(prog_LocalVariables[name2]));
				else RaiseError(`[ERROR] Couldn't DIV variable "${name}" with "${name2}" because it's value type (${typeof prog_LocalVariables[name]} =/= ${typeof prog_LocalVariables[name2]}) doesn't match.`);
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't DIV variable "${name}" because it's type isn't a number.`);
			break;
		}
	}
}

function prog_MOD(array)
{
	let name = array[1];
	let name2 = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't MOD variable "${name}" because it doesn't exists.`);
	else if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't MOD variable "${name2}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "number":
				if (!isNaN(prog_LocalVariables[name2])) prog_LocalVariables[name] %= parseInt(prog_LocalVariables[name2]);
				else RaiseError(`[ERROR] Couldn't MOD variable "${name}" with "${name2}" because it's value type (${typeof prog_LocalVariables[name]} =/= ${typeof prog_LocalVariables[name2]}) doesn't match.`);
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't MOD variable "${name}" because it's type isn't a number.`);
			break;
		}
	}
}

function prog_CLR(array)
{
	FlushOutput();
}

function prog_CST(array)
{
	let name = array[1];
	let name2 = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't CST variable "${name}" because it doesn't exists.`);
	else if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't CST variable "${name2}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "number":
				if (!isNaN(prog_LocalVariables[name2])) prog_LocalVariables[name] = parseInt(prog_LocalVariables[name2]);
				else RaiseError(`[ERROR] Couldn't CST variable "${name}" with "${name2}" because it's value type (${typeof prog_LocalVariables[name]} =/= ${typeof prog_LocalVariables[name2]}) doesn't match.`);
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't CST variable "${name}" because it's type isn't a number.`);
			break;
		}
	}
}

function prog_WSC (array)
{
	if (prog_WebSocket != null) 
	{
		RaiseError("[ERROR] Couldn't WSC because there's already one connection started.");
		return;
	}
	
	let name = array[1];
	let name2 = array[2];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't WSC with variable "${name}" because it doesn't exists.`);
	if (prog_LocalVariables[name2] == null) RaiseError(`[ERROR] Couldn't WSC with variable "${name2}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "number":
				if (typeof prog_LocalVariables[name2] != "string")
				{
					RaiseError(`[ERROR] Couldn't WSC with variable "${name2}" because it's type isn't a string.`);
					return;
				}
				prog_WebSocket = new WebSocket(prog_LocalVariables[name2]);
				prog_WebSocket_messages = [];
				prog_LocalVariables[name] = prog_WebSocket.readyState;
				prog_WebSocket.onmessage = function (msg)
				{
					prog_WebSocket_messages.push(msg.data.toString('utf8'));
				}
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't WSC with variable "${name}" because it's type isn't a number.`);
			break;
		}
	}
}

function prog_WSE (array)
{
	if (prog_WebSocket == null) 
	{
		RaiseError("[ERROR] Couldn't WSE because there's no any connection started.");
		return;
	}
	
	prog_WebSocket.close();
	prog_WebSocket = null;
}

function prog_WSI (array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't WSI with variable "${name}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "number":
				prog_LocalVariables[name] = prog_WebSocket_messages.length;
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't WSI with variable "${name}" because it's type isn't a number.`);
			break;
		}
	}
	
}

function prog_WSR (array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't WSR with variable "${name}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "string":
				let ret = prog_WebSocket_messages.pop();
				if (ret == undefined) ret = "";
				prog_LocalVariables[name] = ret;
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't WSR with variable "${name}" because it's type isn't a string.`);
			break;
		}
	}
	
}

function prog_WSP (array)
{
	if (prog_WebSocket == null) 
	{
		RaiseError("[ERROR] Couldn't WSP because there's no any connection started.");
		return;
	}
	
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't WSP with variable "${name}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "string":
				prog_WebSocket.send(prog_LocalVariables[name]);
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't WSP with variable "${name}" because it's type isn't a string.`);
			break;
		}
	}
	
}

function prog_WSS (array)
{
	let name = array[1];
	
	if (prog_LocalVariables[name] == null) RaiseError(`[ERROR] Couldn't WSS with variable "${name}" because it doesn't exists.`);
	else 
	{
		switch (typeof prog_LocalVariables[name])
		{
			case "number":
				if (prog_WebSocket == null) 
				{
					prog_LocalVariables[name] = 3;
					return;
				}
				prog_LocalVariables[name] = prog_WebSocket.readyState;
			break;
			
			default:
				RaiseError(`[ERROR] Couldn't WSS with variable "${name}" because it's type isn't a number.`);
			break;
		}
	}
	
}




// ### SYS CODE ###

let sys_isListenerSet = false;
let sys_inputKeycodes = {};

function sys_HookInput(inputKey)
{
	sys_inputKeycodes[inputKey] = 0;
	
	if (!sys_isListenerSet) 
	{
		sys_isListenerSet = true;
		
		window.addEventListener("keydown", function sys_catchInputDown(event) 
		{
			if (event.defaultPrevented) { return; } // Do nothing if event already handled
	
			if (sys_inputKeycodes[event.code] != null) { sys_inputKeycodes[event.code] = 1; }
		});
		window.addEventListener("keyup", function sys_catchInputUp(event) 
		{
			if (event.defaultPrevented) { return; } // Do nothing if event already handled
	
			if (sys_inputKeycodes[event.code] != null) { sys_inputKeycodes[event.code] = 0; }
		});
	}
}

function sys_UnhookInput()
{
	try{
	if (sys_isListenerSet) window.removeEventListener("keydown", sys_catchInputDown);
	} catch(e) {}
	try {
	if (sys_isListenerSet) window.removeEventListener("keyup", sys_catchInputUp);
	} catch (e) {}
	
	sys_isListenerSet = false;
	
	sys_inputKeycodes = {};
}
// ################




// ================================
// EXTERNAL CODE: Draggable modal
// ================================
/*

dragElement(document.getElementById("win-draggable-help-modal"));

function dragElement(elmnt) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  if (document.getElementById(elmnt.id + "header")) {
    // if present, the header is where you move the DIV from:
    document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
  } else {
    // otherwise, move the DIV from anywhere inside the DIV:
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
  }

}
*/
