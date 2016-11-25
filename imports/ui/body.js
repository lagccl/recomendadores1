import {Meteor} from "meteor/meteor";
import {Template} from "meteor/templating";
import {ReactiveDict} from "meteor/reactive-dict";
import {Loader} from "../api/loader.js";
import "./recommendation.js";
import "./project.js";
import "./word.js";
import "./login.js";
import "./resource.html";
import "./body.html";

Template.body.onCreated(function bodyOnCreated() {
    this.state = new ReactiveDict();
    this.state.set('isLogged', false);
    this.state.set('loading', false);
    this.state.set('isAdmin', false);
    this.state.set('hasFinished', false);
    this.state.set('count', 0);
    this.state.set('userName', '');
    this.state.set('userEmail', '');
    this.state.set('projectName', '');
    this.state.set('recommendations1', null);
    this.state.set('recommendations2', null);

    Meteor.subscribe('loader');
    /*Meteor.subscribe('ratings');
    Meteor.subscribe('surveis');*/
    /*Meteor.callPromise("utils.projects").then((val) => {
        this.state.set('projects', val);
    });*/
});

Template.body.helpers({
    recommendations1() {
        const instance = Template.instance();
        return instance.state.get('recommendations1');
    },
    recommendations2() {
        const instance = Template.instance();
        return instance.state.get('recommendations2');
    },
    words() {
        const instance = Template.instance();
        return instance.state.get('words');
    },
    isAdmin() {
        const instance = Template.instance();
        return instance.state.get('isAdmin');
    },
    isLogged() {
        const instance = Template.instance();
        return instance.state.get('isLogged');
    },
    incompleteCount() {
        const instance = Template.instance();
        return instance.state.get('count');
    },
    isProcessing(){
        const instance = Template.instance();
        return instance.state.get('loading');
    },
    userName(){
        const instance = Template.instance();
        return instance.state.get('userName');
    },
    userEmail(){
        const instance = Template.instance();
        return instance.state.get('userEmail');
    },
    projectName(){
        const instance = Template.instance();
        return instance.state.get('projectName');
    },
    hasFinished(){
        const instance = Template.instance();
        return instance.state.get('hasFinished');
    },
    projects(){
        const instance = Template.instance();
        return instance.state.get('projects');
    },
    loader(){
        let email = Meteor.user().emails[0].address;
        return Loader.findOne({email: email});
    },
    resources(){
        const instance = Template.instance();
        return instance.state.get('resources');
    }
});

Template.body.events({
    'click #btn_recommend'(event, instance){
        let words = $("#txt_words").tagsinput('items');
        instance.state.set('loading', true);
        Meteor.callPromise("utils.users", words).then((val) => {
            instance.state.set('resources', val);
            instance.state.set('loading', false);
            //Session.set('datos',val);
        });
    },
    'click #saveRating'(event, instance){
        let email = instance.state.get('userEmail');
        Meteor.call('rating.removeAll', email);
        let ratings = $(".rating").each(function (index, e) {
            let postId = $(e).parent().data('id');
            let method = $(e).parent().data('method');
            let rating = $(e).data('userrating');
            Meteor.call('rating.insert', postId, email, method, rating);
        });

    },
    'click #saveSurvey'(event, instance){
        let email = instance.state.get('userEmail');
        let p1 = $("input[name='p1']:checked").val();
        let p2 = $("input[name='p2']:checked").val();
        let p3 = $("input[name='p3']:checked").val();
        let p4 = $("input[name='p4']:checked").val();
        let p5 = $("input[name='p5']:checked").val();
        let opinion = $('#opinion').val();
        Meteor.call('survey.insert', email, p1, p2, p3, p4, p5, opinion);
        $('#survey').modal('hide');
        instance.state.set('hasFinished', true);
    },
    'click #cancelSurvey'(event, instance){
        $('#survey').modal('hide');
        instance.state.set('hasFinished', true);
    },
    'change .sel-project'(event, instance) {
        const target = event.target;
        const id = target.value;
        instance.state.set('loading', true);
        let technique = $("input[name='technique']:checked").val()
        let lda = $("#lda").is(':checked');
        let mf  = $("#mf").is(':checked');
        Meteor.callPromise("utils.recommendations", id, technique, lda, mf).then((val) => {
            instance.state.set('recommendations1', val.result1);
            if (val.result2) {
                instance.state.set('recommendations2', val.result2);
            }
            instance.state.set('words', val.words);
            instance.state.set('count', val.result ? val.result.length : 0);
            //Session.set('datos',val);
            instance.state.set('loading', false);
        });

    }
});
