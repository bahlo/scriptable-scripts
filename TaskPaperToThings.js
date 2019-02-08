// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: check-double;

// These constants are used to determine if a field is a tag (e.g. @home) or an
// attribute (e.g. @due(2019-02-08)).
const FIELD_TYPE_TAG = 'tag';
const FIELD_TYPE_ATTR = 'attr';

// The output expected by the testcase.
const EXPECTED_OUTPUT = `[{"type":"project","attributes":{"when":"2019-02-08","tags":["Home"],"title":"Test project ","notes":"A note to the project","items":[{"type":"to-do","attributes":{"tags":[],"title":"A task","notes":"","checklist-items":[]}},{"type":"to-do","attributes":{"tags":["sometag"],"title":"Another task ","notes":"A note to another task\\nAnother line of notes for another task","checklist-items":[{"type":"checklist-item","attributes":{"tags":[],"title":"A subtask","notes":""}}]}}]}}]`;

// IIFE to capsule "main" function.
(function() {
  const isRunningOnScriptable = typeof Pasteboard !== 'undefined';

  // Get input, if we're in Scriptable from Pasteboard, otherwise test data.
  let input = '';
  if (isRunningOnScriptable) {
    input = Pasteboard.paste();
  } else {
    input = `
- Test project @Home @today
A note to the project
	- A task
	- Another task @sometag
		A note to another task
		Another line of notes for another task
		- A subtask
    `;
  }

  // The Things JSON representation of the TaskPaper input.
  let output = [];

  // Parameters used by the following loop.
  let parentProject = null;
  let parentTask = null;
  let lastItem = null; // Can be task, project or checklist item.

  // Process each line.
  input.split('\n').forEach(line => {
    // Do nothing on empty line.
    if (line.trim() === '') {
      return;
    }

    // If the first char isn't `-`, we have a note.
    if (line.trim().charAt(0) !== '-') {
      if (lastItem === null) {
        throw 'The first line cannot be a note';
      }

      // Add a linebreak if we already have notes on this item.
      // This can happen for multi-line notes.
      if (lastItem.attributes.notes !== '') {
        lastItem.attributes.notes += '\n'; 
      }

      lastItem.attributes.notes += line.trim();
      return;
    }

    // Check how many tabs we have.
    // TODO: Also allow spaces as indention.
    let tabs = 0;
    for (let j = 0; j < line.length; j++) {
      if (line[j] !== '\t') {
        // We have a char which is not a tab.
        break;
      }

      tabs++;
    }

    // Process line depending on indentation.
    switch (tabs) {
      case 0: // Project
        if (parentProject !== null) {
          // Add last project to output.
          console.log(parentProject)
          output.push(parentProject);
        }

        let project = parseProject(line);
        parentProject = project;
        parentTask = null;
        lastItem = project;
        break;
      case 1: // Task
        let task = parseTask(line);
        parentTask = task;
        parentProject.attributes.items.push(task);
        lastItem = task;
        break;
      case 2: // Checklist item
        let item = parseChecklistItem(line);
        parentTask.attributes['checklist-items'].push(item);
        lastItem = item;
        break;
    }
  });

  // Push last project.
  output.push(parentProject);

  // Create JSON string.
  const json = JSON.stringify(output);

  // Copy to clipboard (if in Scriptable), otherwise test.
  if (isRunningOnScriptable) {
    Pasteboard.copy(output);
  } else {
    // Test output.
    if (json !== EXPECTED_OUTPUT) {
      throw `Output differs!
        expected: ${EXPECTED_OUTPUT}
        actual:   ${json}
      `;
    } else {
      console.log('Looks good.');
    }
  }
})();

/**
 * Parse a project line.
 *
 * @param   {string} line
 * @returns {object}      Things representation of the project.
 */
function parseProject(line) {
  const { title, attributes } = parseLine(line)
  return {
    type: 'project',
    attributes: {
      ...attributes,
      title,
      notes: '',
      items: [],
    }
  }
}

/**
 * Parse a task line.
 *
 * @param   {string} line
 * @returns {object}      Things representation of the task.
 */
function parseTask(line) {
  const { title, attributes } = parseLine(line)
  return {
    type: 'to-do',
    attributes: {
      ...attributes,
      title,
      notes: '',
      'checklist-items': [],
    }
  }
}

/**
 * Parse a checklist-item line.
 *
 * @param   {string} line
 * @returns {object}      Things representation of the checklist item.
 */
function parseChecklistItem(line) {
  const { title, attributes } = parseLine(line)
  return {
    type: 'checklist-item',
    attributes: {
      ...attributes,
      title,
      notes: '',
    }
  }
}

/**
 * Helper function used by parse{Project,Task,ChecklistItem} to get title and fields.
 *
 * @param  {string} rawLine The raw, untrimmed line
 * @return {object}         An object containing the keys `title` and `attribute`
 */
function parseLine(rawLine) {
  let line = rawLine.trim().substring(2);

  // Get title
  let matches = line.match(/^[^@]+/)
  if (matches === null) {
    throw 'Could not match title'
  }
  const title = matches[0];

  // Get attributes
  let tags = [];
  let attributes = {};
  matches = line.match(/(@[^\s]+)/g)
  if (matches !== null) {
    for (let i = 0; i < matches.length; i++) {
      let { type, key, value } = parseField(matches[i])
      if (type === FIELD_TYPE_TAG) {
        tags.push(key);
      } else if (type === FIELD_TYPE_ATTR) {
        attributes[key] = value;
      }
    }
  }

  return {
    title,
    attributes: {
      ...attributes,
      tags
    }
  }
}

/** 
 * Parse a field (e.g. @due(2019-02-08).
 *
 * There are two kinds of fields:
 * 1. Tags (e.g. @home)
 * 2. Attributes (e.g. @due(2019-02-08))
 * The type is one of FIELD_TYPE_ATTR, FIELD_TYPE_TAG
 *
 * @param   {string} raw
 * @returns {object}     An object with the keys `type`, `key` and `value`
 */
function parseField(raw) {
  // This will be returned by this function
  let res = {
    type: FIELD_TYPE_TAG, // default, can also be FIELD_TYPE_ATTR
    key: null,
    value: null,
  }

  // Get key (required)
  let matches = raw.match(/@([^\s(]+)/)
  if (matches === null) {
    throw 'Invalid tag: ' + raw
  }
  res.key = matches[1]

  // Get value if set
  let value = null;
  matches = raw.match(/@[^\s(]+\(([^\)]+)\)/)
  if (matches !== null) {
    res.value = matches[1]
    res.type = FIELD_TYPE_ATTR
  }

  // Check for basic special fields
  if (res.type === FIELD_TYPE_TAG) {
    switch (res.key) {
      case 'done':
        res.type = FIELD_TYPE_ATTR
        res.key = 'completed'
        res.value = true
        break;
      case 'today':
        res.type = FIELD_TYPE_ATTR
        res.key = 'when'
        res.value = formatDate(new Date())
        break;
      case 'start':
        res.type = FIELD_TYPE_ATTR
        res.key = 'when'
        break;
      case 'due':
        res.type = FIELD_TYPE_ATTR
        res.key = 'deadline'
        break;
    }
  }

  return res
}

/**
 * Format a date to YYYY-MM-DD
 * @param   {Date}   Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  const pad = num => {
    if (num < 10) {
      return `0${num}`
    }
    return num
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
