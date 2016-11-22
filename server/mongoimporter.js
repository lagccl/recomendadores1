import {Meteor} from "meteor/meteor";
import jsonFile from "jsonfile";
import { Projects } from '../imports/api/projects';
import { Tasks } from '../imports/api/tasks';
import { SubTasks } from '../imports/api/subTasks';
import { Commits } from '../imports/api/commits';


export function importData() {
    console.log("Connection successful");
    let Users = Meteor.users;

    insertCollection("users", Meteor.bindEnvironment((element) => {
        let user = {};

        user._id = element["id"].toString();
        user.createdAt = element["created_at"];
        user.services = {
            password: {
                bcrypt: element["encrypted_password"]
            }
        };
        user.emails = [{
            address: element["email"],
            verified: true
        }];
        user.isAdmin = element["email"] == 'jddiaz41@uc.cl' || element["email"] == 'psanabria@uc.cl';
        user.name = element["name"];
        Users.insert(user);
    }));
    insertCollection("projects", Meteor.bindEnvironment((element) => {
        let project = JSON.parse(JSON.stringify(element));

        project._id = element["id"].toString();
        delete project["id"];

        Projects.insert(project);
    }));
    insertCollection("tasks", Meteor.bindEnvironment((element) => {
        let task = JSON.parse(JSON.stringify(element));

        task._id = element["id"].toString();
        delete task["id"];

        Tasks.insert(task);
    }));
    insertCollection("sub_tasks", Meteor.bindEnvironment((element) => {
        let subTask = JSON.parse(JSON.stringify(element));

        subTask._id = element["id"].toString();
        delete subTask["id"];

        SubTasks.insert(subTask);
    }));
    insertCollection("commits", Meteor.bindEnvironment((element) => {
        let commit = JSON.parse(JSON.stringify(element));

        commit._id = element["id"].toString();
        delete commit["id"];

        Commits.insert(commit);
    }));
}

function insertCollection(name, process) {
    let file = name + ".json";
    let path = Assets.absoluteFilePath(file);

    jsonFile.readFile(path, function (error, obj) {
        if (error != null) {
            console.log("error reading file ", error);
            done();
            return;
        }
        console.log(name);
        obj.forEach((element) => {
            process(element);
        });
    });
}
