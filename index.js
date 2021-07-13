const config = require('./config.json')
const members = require('./members.json')
const mappings = require('./mappings.json')

let Discord = require('discord.js');
let Client = new Discord.Client();
let isReady = true;
let triggers = new RegExp(Object.keys(mappings).join("|"));
let sleep = require('util').promisify(setTimeout);
let currentDiplo = "not defined";
let isDiploDefined = false;
let diploEndOfTerm;
let resetInterval;
let isNewDiplo = false;

Client.login(config.discordToken);
Client.on('message', message => {
	if (message.content.startsWith(config.symbol, 0)) {
		handleCommand(message);
	} else {
		if (message.author.id != config.botId && messageContainsTrigger(message)) {
			let match = message.content.toLowerCase().match(triggers);
			let response = mappings[match];
			handleRandomEvent(message, response);
		}
	}
});

Client.on("ready", function () {
	// Uncomment this to set the avatar to what you want then comment it again so it doesn't hit the API rate limit
	/*Client.user.setAvatar(config.avatarUrl).then(r => {
		console.log("Avatar set to : ", config.avatarUrl)
	});*/
	var now = new Date();
	diploEndOfTerm = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 59));
	var millisTillReset = diploEndOfTerm - now;
	rollDiplo();
	if (millisTillReset < 0) {
		millisTillReset += 86400000; // if it's after 23h59:59s, try tomorrow (shouldn't happen unless unlucky)
	}
	//Run handleServerReset in millisTillReset ms
	setTimeout(handleServerReset, millisTillReset);
	if (Client.user.username !== config.botUsername) {
		console.log("Setting bot name to : " + config.botUsername);
		Client.user.setUsername(config.botUsername);
	}
});

function handleCommand(message) {
	let commandArgs = message.content.substr(1).split(" ");
	let command = commandArgs[0];
	console.log(`Received command : ${command}`)
	console.log(`With args : ${commandArgs}`)
	switch (command) {
		case "hello":
			sayHello(message);
			break;
		case "help":
			writeHelp(message);
			break;
		case "diplo":
			getDiplo(message, commandArgs);
			break;
		default:
			message.channel.send(`The command ${command} is not supported, ${message.author}!\nPlease refer to the help by writing ${config.symbol}help`);
			break;
	}
}

function handleServerReset() {
	console.log("Server reset time.");
	rollDiplo();
	if (resetInterval === undefined) {
		resetInterval = setInterval(handleServerReset, 24 * 60 * 60 * 1000 /* One full day*/);
	}

}

function sayHello(message) {
	message.channel.send(`Hello ${message.author} !\nHow are doing in this joly day ?\nI hope you find some nice trash ! (I'm not speaking of Carl here)`);
}

function writeHelp(message) {
	switch (message.author.id) {
		case members.Lisbeth:
			message.channel.send(`Can't help you, you're stuck with us FOREVER!`);
			break;
		case members.bawler:
			message.channel.send(`A special message for our 'special' friend ${message.author}`);
			break;
		case members.ava_mara:
			message.channel.send(`You don't need help Ava, your enemies do though!`);
			break;
		default:
			message.channel.send(`HELP`);
			break;
	}
}

function getDiplo(message, commandArgs) {
	console.log(commandArgs.length);
	if (commandArgs.length > 1) {
		if (message.author.id === members.Azgarreth) {
			switch (commandArgs[1]) {
				case "roll":
					rollDiplo();
					break;
				case "set":
					currentDiplo = commandArgs[2];
					isNewDiplo = true;
					break;
			}
		} else {
			message.channel.send(`You don't have the permissions to do that ${message.author}, you pleb!`);
		}
	}
	if (!isDiploDefined) {
		message.channel.send(`I didn't get a chance to select our diplo for the day. If you want me to roll it now just write ${config.symbol}diplo roll`);
	} else {
		if (isNewDiplo) {
			message.channel.send(`Current diplo is <@${members[currentDiplo]}> until next server reset on ${diploEndOfTerm.toUTCString()}`);
			isNewDiplo = false;
		} else {
			message.channel.send(`Current diplo is ${currentDiplo} until next server reset on ${diploEndOfTerm.toUTCString()}`);
		}
	}
}

function rollDiplo() {
	let membersNames = Object.keys(members);
	currentDiplo = membersNames[randomIntFromInterval(0, membersNames.length - 1)];
	isDiploDefined = true;
	let now = new Date();
	diploEndOfTerm = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 59));
	isNewDiplo = true;
	console.log(`Set current diplo to : ${currentDiplo} until ${diploEndOfTerm.toUTCString()}`);
}

function randomIntFromInterval(min, max) { // min and max included
	return Math.floor(Math.random() * (max - min + 1) + min)
}

function messageContainsTrigger(message) {
	if (triggers.test(message.content)) {
		console.log(`found trigger : ${message.content.match(triggers)}`);
		return true;
	}
	return false;
}

function handleRandomEvent(message, response) {
	let randomResponseNumber = 0;
	if (Object.keys(response).length > 1) {
		randomResponseNumber = randomIntFromInterval(0, Object.keys(response).length);
	}
	console.log(`Using random response ${randomResponseNumber}`);
	let randomResponse = response[randomResponseNumber];
	console.log(randomResponse);
	if (isReady) {
		//if (messageHasOneMention(message)) {
		//	playAudioToMention(message)
		//} else {
		playAudioToAuthor(message, randomResponse.file)
		//}
	}
}

// -------------- AUDIO PART ----------------- //
function checkIfConnectedOnVoice(member, message) {
	if (member.voice.channel == null) {
		console.log(message.member + " is not connected to any voice channel.");
		message.channel.send(`Too bad you aren't in any audio channel to hear my sass, ${message.author}`);
		return false;
	}
	return true;
}

function playAudioToAuthor(message, file) {
	var voiceChannel = message.member.voice.channel;
	playAudio(message, message.member, voiceChannel, file);
}

function playAudio(message, member, voiceChannel, file) {
	console.log("Playing audio from " + message.author.username + " to " + message.guild.member(member).user.username);
	if (checkIfConnectedOnVoice(member, message)) {
		isReady = false;
		voiceChannel.join().then(connection => {
			sleep(500).then(() => {
				const dispatcher = connection.play(file).catch(err => {
					console.log(err);
					voiceChannel.leave();
				});
				dispatcher.on("end", end => {
					voiceChannel.leave();
				});
				dispatcher.catch(err => {
					console.log(err);
					voiceChannel.leave();
				});
			});
			setTimeout(function () {
				voiceChannel.leave();
			}, 30000);
		}).catch(err => console.log(err));
		isReady = true;
	}
	console.log("------------------------");
}

function playAudioToMention(message) {
	message.mentions.users.forEach(user => {
		var voiceChannel = message.guild.member(user.id).voice.channel;
		playAudio(message, message.guild.member(user.id), voiceChannel);
	})
}

function messageHasOneMention(message) {
	if (message.mentions.users.size == 1) {
		return true;
	} else if (message.mentions.users.size > 1) {
		message.channel.send(`Tu ne peux mentionner qu'une seule personne, ${message.author}!`);
	}
	return false;
}

function removeMention(content) {
	var sanitizedContent = content.replace(/<@!?\d*>/g, "").trimLeft().trimRight();
	return sanitizedContent;
}
