import {Meteor} from "meteor/meteor";
import jsonFile from "jsonfile";
import { Projects } from '../imports/api/projects';


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
    insertCollection("projects");
    insertCollection("sub_tasks");
    insertCollection("tasks");
    insertCollection("commits");
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
        obj.forEach((element) => {
            if (process != null) {
                process(element);
            } else {
                process = Meteor.bindEnvironment((element) => {
                    let project = JSON.parse(JSON.stringify(element));

                    project._id = element["id"].toString();
                    delete project["id"];

                    Projects.insert(project);
                });
                process(element);
            }
        });
    });
}
