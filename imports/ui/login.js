import {Accounts} from "meteor/accounts-base";
import {UserProject} from "../startup/user-project";
import "./login.html";

Template.login.onRendered(function () {
    var parentView = Blaze.currentView.parentView.parentView;
    this.parentInstance = parentView.templateInstance().state;
});

Template.login.events({
    'submit form'(event) {
        event.preventDefault();
        const instance = Template.instance();
        //let email = 'jddiaz4@uc.cl';
        let email = $("#login_email").val();
        let pwd = $("#login_pwd").val();
        //let pwd = 'smart110889*';
        loginWith(email, pwd, instance);
    }
});

function loginWith(email, pwd, instance) {
    Accounts.callLoginMethod({
        methodArguments: [{
            user: {email: email},
            password: {
                digest: pwd, // It's not sha-256, it's plain password
                algorithm: "sha-256"
            }
        }],
        userCallback(error) {
            if (!error) {
                let userInfo = Meteor.user();
                let info = UserProject[email];
                let id = info.id;
                let technique = info.technique;
                let lda = info.lda;
                let mf = info.mf;
                console.log(userInfo.isAdmin);
                instance.parentInstance.set('isAdmin', userInfo.isAdmin);
                instance.parentInstance.set('userName', userInfo.name);
                instance.parentInstance.set('userEmail', userInfo.email);
                instance.parentInstance.set('projectName', info.projectName);
                if (!userInfo.isAdmin) {
                    instance.parentInstance.set('loading', true);
                    Meteor.callPromise("utils.recommendations", id, technique, lda, mf).then((val_aux) => {
                        instance.parentInstance.set('recommendations1', val_aux.result1);
                        if (val_aux.result2) {
                            instance.parentInstance.set('recommendations2', val_aux.result2);
                        }
                        instance.parentInstance.set('words', val_aux.words);
                        instance.parentInstance.set('count', val_aux.result ? val_aux.result.length : 0);
                        //Session.set('datos',val);
                        instance.parentInstance.set('loading', false);
                    });
                }
            } else {
                alert(error)
            }
            instance.parentInstance.set('isLogged', !error);
        }
    });
}
