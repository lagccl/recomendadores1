import {Meteor} from 'meteor/meteor';
import {Blaze} from 'meteor/blaze';
import {Template} from 'meteor/templating';
import {Accounts} from "meteor/accounts-base";
import {UserProject} from "../startup/user-project";
import "./login.html";

Template.login.onRendered(function () {
    let parentView = Blaze.currentView.parentView.parentView;
    this.parentInstance = parentView.templateInstance().state;
});

Template.login.events({
    'submit form'(event) {
        event.preventDefault();
        const instance = Template.instance();
        let email = $("#login_email").val();
        let pwd = $("#login_pwd").val();
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
                //let userInfo = Meteor.users.findOne({'_id': user._id});
                let info = UserProject[email];
                if(info) {
                  let id = info.id;
                  let technique = info.technique;
                  let lda = info.lda;
                  let mf = info.mf;
                  let isAdmin = false;

                  if ( email == 'jddiaz41@uc.cl' || email == 'psanabria1@uc.cl' )
                      isAdmin = true;

                  instance.parentInstance.set('isAdmin', isAdmin);
                  instance.parentInstance.set('userName', info.username);
                  instance.parentInstance.set('userEmail', email);
                  instance.parentInstance.set('projectName', info.name);

                  Meteor.call('loader.removeAll',email);
                  Meteor.call('loader.insert',email,0,'');

                  if (!isAdmin) {
                      instance.parentInstance.set('loading', true);
                      Meteor.callPromise("utils.recommendations", id, technique, lda, mf).then((val_aux) => {
                      //Meteor.call("utils.recommendations", id, technique, lda, mf, function(val_aux){
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
              }else{
                alert('Lo sentimos, no se encuentra habilitado para usar esta herramienta.');
                error = true;
              }
            } else {
                alert(error)
            }
            instance.parentInstance.set('isLogged', !error);
        }
    });
}
