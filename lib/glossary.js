'use strict';

// Plain-English definitions for common technical jargon.
// Used to keep vocabulary consistent across the CLI, the skill, and the hook.
const GLOSSARY = {
  dependency: 'a piece of pre-written code your project needs to work, made by someone else',
  package: 'a bundle of pre-written code you can add to your project',
  module: "a named piece of code (often the same thing as a 'package')",
  'stack trace': 'the trail of steps the program was in the middle of when it crashed',
  traceback: 'Python\'s name for a stack trace',
  'exit code': 'a number a program leaves behind saying whether it worked (0) or failed (anything else)',
  terminal: 'the text-only window used to type commands directly to the computer',
  repository: "a project's folder, tracked by Git so changes can be saved and undone",
  repo: 'short for repository',
  commit: 'a saved snapshot of your project at a point in time',
  branch: 'a separate, parallel copy of your project you can experiment in safely',
  'merge conflict': 'when two saved versions changed the same lines and Git can\'t tell which one to keep',
  'environment variable': 'a setting stored outside your code, often used for secrets like passwords or API keys',
  'api key': 'a password-like code that lets your project talk to another company\'s service',
  permission: 'the operating system\'s rule about who is allowed to read, change, or run a file',
  sudo: 'a command that temporarily gives you admin-level power over the whole computer',
  daemon: 'a program that runs quietly in the background (Docker uses this word for its background service)',
  port: "a numbered 'door' a program listens on to receive network traffic",
  compile: 'translating human-written code into a form the computer can run',
  'syntax error': 'a typo or grammar mistake in the code itself',
  null: "programmer-speak for 'nothing' or 'no value'",
  undefined: "programmer-speak for 'this was never given a value'",
  exception: 'the formal name for an error a program raises when something goes wrong',
  npm: "Node.js's tool for downloading and managing packages",
  pip: "Python's tool for downloading and managing packages",
  'virtual environment': 'an isolated, private copy of Python and its packages just for one project',
  path: 'the list of folders the computer searches through to find a program when you type its name',
  symlink: 'a shortcut file that points to another file or folder',
  cache: 'a folder of temporarily saved files kept around to make things faster next time',
};

function define(term) {
  return GLOSSARY[String(term).toLowerCase()] || null;
}

module.exports = { GLOSSARY, define };
