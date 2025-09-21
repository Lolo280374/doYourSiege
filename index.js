#!/usr/bin/env node

const {program} = require("commander");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
const { abort } = require("process");

const listfile = path.join(__dirname, "todolist.json");

if (!fs.existsSync(listfile)) {
    fs.writeFileSync(listfile, JSON.stringify([]));
}

function loadList() {
    return JSON.parse(fs.readFileSync(listfile));
}

function saveList(todos) {
    fs.writeFileSync(listfile, JSON.stringify(todos, null, 2));
}

program
    .command("add <title>")
    .description(`add a task to your todo list; e.g: todo add "homework" --desc "page 45";`)
    .option("--desc <description>", "task's description")
    .option("--due <date>", "the time by when the task must be done, in YYYY-MM-DD HH:mm format")
    .option("--file <literral path>", "file path that you could link to your task (e.g: study notes)")
    .option("--priority <status>", "the priority (high, med, low), to make it appear first in front of your other todos")
    .action((title, options) => {
        const todos = loadList();
        const todo = {
            id: Date.now(),
            title,
            description: options.desc || "",
            due: options.due || null,
            file: options.file ||null,
            priority: options.priority || null,
            done: false,
        };
        todos.push(todo);
        saveList(todos);
        console.log(chalk.green("added yo' task to your list!"));
    });

program
    .command("delete [id/all]")
    .alias("del")
    .alias("remove")
    .alias("rm")
    .description("fully deletes a task from the list and the JSON;")
    .action((id) =>  {
        let todos = loadList();
        if (!id) {
            console.log(chalk.yellow("you must provide the task's ID, or 'all' to delete all tasks!"));
            return;
        }
        if (id.toLowerCase() === "all") {
            if (!todos.length) {
                console.log(chalk.yellow("you don't have any tasks!"));
                return;
            }
            const readline = require("readline");
            const r1 = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            r1.question(
                chalk.red("are you sure to delete all your tasks? you can't undo this! (y/n) "),
                (answer) => {
                    r1.close();
                    const confirm = answer.trim().toLowerCase();
                    if (confirm === "y" || confirm === "yes") {
                        saveList([]);
                        console.log(chalk.red("all tasks have been deleted!"));
                    } else {
                        console.log(chalk.yellow("cancelled. no tasks have been touched. if you meant to delete, make sure your input was 'y' or 'yes'..."));
                    }
                }
            );
            return;
        }
        const index = todos.findIndex(t => t.id.toString() === id);
        if (index === -1) {
            console.log(chalk.red("that task dosen't exist!"));
            return;
        }
        const removed = todos.splice(index, 1)[0];
        saveList(todos);
        console.log(chalk.red(`deleted the ${chalk.bold(removed.title)} task (ID: ${removed.id})`));
    });

program
    .command("list")
    .description("lists all your tasks, whether completed or not;")
    .action(() => {
        const readline = require("readline");
        const r1 = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        r1.question("are you trying to see the (c)ompleted or (i)ncomplete tasks? \ntype c for completed, i for incomplete. ", (answer) => {
            r1.close();
            console.log();
            let showDone;
            if (answer.toLowerCase() === "c") showDone = true;
            else showDone = false;
            const todos = loadList().filter(t => t.done === showDone);
            if (!todos.length) {
                console.log(chalk.yellow("no tasks to list."));
                return;
            }
            todos.sort((a, b) => (a.due || "").localeCompare(b.due || ""));
            todos.forEach(t => {
            let parts = [];
            parts.push(chalk.cyan(t.title));
            if (t.description) parts.push(t.description);
            if (t.due) parts.push(`due: ${chalk.red(t.due)}`);
            if (t.priority) parts.push(`priority: ${chalk.yellow(t.priority)}`);
            parts.push(`ID: ${t.id}`);
            let line = parts.join(" - ");
            if (t.file) {
                line += `\n${chalk.green("attachment: ")}${chalk.underline(t.file)}`;
            }
            console.log(line + "\n");
        });
    });
});

// priority logic: priority is first (high; med; low), deadline comes second, and if either dosent exist the todo is last

    program
        .command("upcoming")
        .description("shows your 5 upcoming tasks, rated by priority, and deadline;")
        .action(() => {
            const todos = loadList().filter(t => !t.done);
            if (!todos.length) {
                console.log(chalk.green("you finished all your tasks!"));
                return;
            }

            const priorityWeight = {
                high: 3,
                High: 3,
                Med: 2,
                Medium: 2,
                med: 2,
                medium: 2,
                Low: 1,
                low: 1,
                null: 0,
            };

            todos.sort((a, b) => {
                const aPriority = a.priority ? priorityWeight[a.priority] || 0 : 0;
                const bPriority = b.priority ? priorityWeight[b.priority] || 0 : 0;
                if (aPriority !== bPriority) {
                    return bPriority - aPriority;
                }
                if (a.due && b.due) {
                    return new Date(a.due) - new Date(b.due);
                }
                if (a.due && !b.due) return -1;
                if (!a.due && b.due) return 1;
                return 0;
            });
            const nextTasks = todos.slice(0, 5);
            nextTasks.forEach((t, idx) => {
                let line = `${idx + 1}. ${chalk.cyan(t.title)}`;
                if (t.due) line += ` - due: ${chalk.red(t.due)}`;
                if (t.priority) line += ` - priority: ${chalk.yellow(t.priority)}`;
                if (t.file) line += `\n ${chalk.green("attachment: ")}${chalk.underline(t.file)}`;
                console.log(line + "\n");
            });
        });

// command used by bashrc, zshrc, and other shells as an autostart command, not meant for actual use, but it can be I guess?
    program
        .command("quickinfo")
        .description("this command is meant to be used by an auto-start shell. this shows brief info about your next tasks, to always be up to date;")
        .alias("shell")
        .action(() => {
            const todos = loadList().filter(t => !t.done);
            const now = new Date();
            const timeStr = now.toTimeString().slice(0, 5);
            if (todos.length === 0) {
                console.log(`${timeStr} - ${chalk.green("you completed all your tasks! ggs :D")}`);
                return;
            }

            const tasksWithDue = todos.filter(t => t.due);
            const tasksWithPriority = todos.filter(t => !t.due && t.priority);
            const otherTasks = todos.filter(t => !t.due && !t.priority);

            if (tasksWithDue.length > 0) {
                const sorted = tasksWithDue.sort((a, b) => {
                    const priorityMap = { high: 3, High: 3, Med: 2, Medium: 2, med: 2, medium: 2, Low: 1, low: 1, null: 0,};
                    const pA = priorityMap[a.priority] || 4;
                    const pB = priorityMap[b.priority] || 4;
                    if (pA !== pB) return pA - pB;
                    return (a.due || "").localeCompare(b.due || "");
                });
                const next = sorted [0];
                const filePath = next.file ? `\none attachment: ${next.file}` : "";
                console.log(`${timeStr} - ${chalk.blue("you still have upcoming tasks!")}`);
                console.log(`${chalk.blue(`remember to finish "${next.title}" by ${next.due}!`)}${chalk.underline(filePath)}`);
                console.log();
                return;
            }

            if (tasksWithPriority.length > 0) {
                const sorted = tasksWithPriority.sort((a, b) => {
                    const priorityMap = { high: 3, High: 3, Med: 2, Medium: 2, med: 2, medium: 2, Low: 1, low: 1, null: 0,};
                    return (priorityMap[a.priority] || 4) - (priorityMap[b.priority] || 4);
                });
                const top = sorted[0];
                const count = sorted.length - 1;
                const filePath = top.file ? `\none attachment: ${top.file}` : "";
                console.log(`${timeStr} - ${chalk.blue(`you still have upcoming tasks, but none have a due date! here's the most high priority one:`)}`);
                console.log(`${chalk.blue(`remember to finish "${top.title}"${count > 0 ? ` + (${count}) others` : ""}`)}${chalk.underline(filePath)}`);
                console.log();
                return;
            }

            if (otherTasks.length > 0) {
                console.log(`${timeStr} - ${chalk.yellow(`you still have (${otherTasks.length}) tasks remaining! use 'todo list' to show them all.`)}`);
                console.log(`${chalk.yellow("=> make sure to add due dates or priorities next time to get more info immediatly!")}`);
                console.log();
            }
        });

    program
        .command("done [id]")
        .description("marks said task as completed, hiding it from lists and upcoming;")
        .action((id) => {
            let todos = loadList();
            const task = todos.find(t => t.id.toString() === id);
            if (!task) {
                console.log(chalk.red("that task dosen't exist!"));
                return;
            }
            task.done = true;
            saveList(todos);
            console.log(chalk.green(`you marked ${chalk.bold(task.title)} with an ID of ${task.id ? `${task.id}` : ""} as complete! ggs :)`));
        });

    program
        .command("undo [id]")
        .description("allows you to undo a said task and mark it as incomplete;")
        .action((id) => {
            let todos = loadList();
            const task = todos.find(t => t.id.toString() === id);
            if (!task) {
                console.log(chalk.red("that task dosen't exist!"));
                return;
            }
            task.done = false;
            saveList(todos);
            console.log(chalk.yellow(`you undid ${chalk.bold(task.title)} with an ID of ${task.id}. it will appear again in lists and others.`));
        });


// i know this is fucking extremely unoptimized but hey it works and it's sunday its already 1PM and i have stuff to do today
// if you see this blame school in france for being a 8-6 job
// cheers
program
  .command("calview")
  .description("open a calendar-alike TUI to view your tasks more easily")
  .action(() => {
    const blessed = require("blessed");
    const todos = loadList();
    const screen = blessed.screen({
      smartCSR: true,
      title: "doYourSiege",
    });
    
    let currentDate = new Date();
    let currentYear = currentDate.getFullYear();
    let currentMonth = currentDate.getMonth();
    let selectedDay = currentDate.getDate();
    let activePanel = 'calendar';
    
    const layout = blessed.layout({
      parent: screen,
      width: '100%',
      height: '100%',
    });

    const calendar = blessed.box({
      parent: layout,
      top: 0,
      left: 0,
      width: '50%',
      height: '50%',
      label: " calendar view ",
      border: {
        type: 'line',
      },
      tags: true,
      scrollable: true,
      keys: true,
      vi: true,
      style: {
        focus: {
          border: {
            fg: 'blue',
          }
        }
      }
    });

    const prevMonthButton = blessed.button({
      parent: calendar,
      content: '< prev',
      top: 1,
      left: 2,
      width: 8,
      height: 1,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'blue',
        focus: {
          fg: 'white',
          bg: 'red',
        },
        hover: {
          bg: 'green',
        }
      }
    });

    const nextMonthButton = blessed.button({
      parent: calendar,
      content: 'next >',
      top: 1,
      left: 12,
      width: 8,
      height: 1,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'blue',
        focus: {
          fg: 'white',
          bg: 'red',
        },
        hover: {
          bg: 'green',
        }
      }
    });

    const noDueList = blessed.list({
      parent: layout,
      top: '50%',
      left: 0,
      width: '50%',
      height: '50%',
      label: " tasks w/o due date ",
      border: {
        type: 'line',
      },
      tags: true,
      keys: true,
      vi: true,
      interactive: true,
      scrollable: true,
      items: [],
      style: {
        selected: {
          bg: 'blue',
          fg: 'white',
        },
        focus: {
          border: {
            fg: 'blue',
          }
        }
      }
    });

    const dayTasksList = blessed.list({
      parent: layout,
      top: 0,
      left: '50%',
      width: '50%',
      height: '50%',
      label: " tasks due for the selected date ",
      border: {
        type: 'line',
      },
      tags: true,
      keys: true,
      vi: true,
      interactive: true,
      scrollable: true,
      items: [],
      style: {
        selected: {
          bg: 'blue',
          fg: 'white',
        },
        focus: {
          border: {
            fg: 'blue',
          }
        }
      }
    });

    const taskDetails = blessed.box({
      parent: layout,
      top: '60%',
      left: '50%',
      width: '50%',
      height: '50%',
      label: " details for the selected task ",
      content: "start by selecting a task either from calendar or the w/o due dates tab...",
      border: {
        type: 'line',
      },
      tags: true,
      scrollable: true,
      style: {
        focus: {
          border: {
            fg: 'blue',
          }
        }
      }
    });

    function getMonthName(month) {
      return new Date(0, month).toLocaleString('default', { month: 'long' });
    }

    function updateCalendarView() {
      const monthName = getMonthName(currentMonth);
      const firstDay = new Date(currentYear, currentMonth, 1).getDay();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      
      let calendarContent = `{center}{bold}${monthName} ${currentYear}{/bold}{/center}\n\n\n`;
      
      calendarContent += "Su Mo Tu We Th Fr Sa\n";
      
      let day = 1;
      let weekLine = "";
      for (let i = 0; i < firstDay; i++) {
        weekLine += "   ";
      }
      
      for (let i = firstDay; i < 7; i++) {
        if (day === selectedDay) {
          weekLine += `{bold}{inverse}${String(day).padStart(2, ' ')}{/inverse}{/bold} `;
        } else {
          weekLine += `${String(day).padStart(2, ' ')} `;
        }
        day++;
      }
      calendarContent += weekLine + "\n";
      
      while (day <= daysInMonth) {
        weekLine = "";
        for (let i = 0; i < 7 && day <= daysInMonth; i++) {
          if (day === selectedDay) {
            weekLine += `{bold}{inverse}${String(day).padStart(2, ' ')}{/inverse}{/bold} `;
          } else {
            weekLine += `${String(day).padStart(2, ' ')} `;
          }
          day++;
        }
        calendarContent += weekLine + "\n";
      }
      
      calendarContent += "\n{bold}how to use:{/bold}\n";
      calendarContent += "- use tab to move between each panel (blue outline)\n";
      calendarContent += "- enter a date number (e.g: 30) to select the 30th day of the selected month\n";
      calendarContent += "- use the left or right arrow key to select to go backwards or upwards\n";
      calendarContent += "- hit enter or space to go up/down in months (after selecting); or to select a task";
      
      calendar.setContent(calendarContent);
    }

    function updateDayTasks() {
      const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      const tasks = todos.filter(t => t.due && t.due.startsWith(dayStr) && !t.done);
      
      dayTasksList.setLabel(` tasks due for: ${dayStr} `);
      
      if (!tasks.length) {
        dayTasksList.setItems([`there's no tasks due for ${dayStr}...`]);
      } else {
        dayTasksList.setItems(tasks.map(t => t.title));
      }
      
      dayTasksList.tasks = tasks;
    }

    function updateNoDueTasks() {
      const tasksNoDue = todos.filter(t => !t.due && !t.done);
      noDueList.setItems(tasksNoDue.map(t => t.title));
      
      noDueList.tasks = tasksNoDue;
    }

    function showTaskDetails(task) {
      if (!task) {
        taskDetails.setContent("you didn't select anything!");
        return;
      }
      
      let content = `{bold}${task.title}{/bold}\n\n`;
      
      if (task.description) {
        content += `{underline}description:{/underline}\n${task.description}\n\n`;
      }
      
      if (task.due) {
        content += `{underline}due for:{/underline} ${task.due}\n\n`;
      }
      
      if (task.priority) {
        content += `{underline}set priority:{/underline} ${task.priority}\n\n`;
      }
      
      if (task.file) {
        content += `{underline}attached file:{/underline} ${task.file}\n\n`;
      }
      
      content += `ID: ${task.id}`;
      
      taskDetails.setContent(content);
    }

    function initializeAll() {
      updateCalendarView();
      updateDayTasks();
      updateNoDueTasks();
      screen.render();
    }

    prevMonthButton.on('press', () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      selectedDay = 1;
      updateCalendarView();
      updateDayTasks();
      screen.render();
    });

    nextMonthButton.on('press', () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      selectedDay = 1;
      updateCalendarView();
      updateDayTasks();
      screen.render();
    });

    dayTasksList.on('select', (item, index) => {
      if (dayTasksList.tasks && dayTasksList.tasks[index]) {
        showTaskDetails(dayTasksList.tasks[index]);
        screen.render();
      }
    });

    noDueList.on('select', (item, index) => {
      if (noDueList.tasks && noDueList.tasks[index]) {
        showTaskDetails(noDueList.tasks[index]);
        screen.render();
      }
    });

    screen.key(['tab'], () => {
      if (activePanel === 'calendar') {
        activePanel = 'noDue';
        noDueList.focus();
      } else if (activePanel === 'noDue') {
        activePanel = 'dayTasks';
        dayTasksList.focus();
      } else {
        activePanel = 'calendar';
        calendar.focus();
      }
      screen.render();
    });

    let buffer = "";
    let timer = null;
    screen.on('keypress', (ch, key) => {
      if (activePanel !== 'calendar') return;
      
      if (/^[0-9]$/.test(ch)) {
        buffer += ch;
        clearTimeout(timer);
        timer = setTimeout(() => {
          const day = parseInt(buffer, 10);
          if (day >= 1 && day <= new Date(currentYear, currentMonth + 1, 0).getDate()) {
            selectedDay = day;
            updateCalendarView();
            updateDayTasks();
            screen.render();
          }
          buffer = "";
        }, 500);
      }
      
      else if (key.name === 'left' || key.name === 'right') {
        if (key.name === 'left') {
          prevMonthButton.focus();
        } else {
          nextMonthButton.focus();
        }
        screen.render();
      }
    });

    screen.key(['escape', 'q', 'C-c'], () => process.exit(0));

    initializeAll();
    calendar.focus();
    activePanel = 'calendar';
  });

program.parse();