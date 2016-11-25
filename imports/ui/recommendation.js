import {Template} from "meteor/templating";
import "./recommendation.html";

Template.recommendation.events({
    'change .rating'(event) {
        console.log($('#' + event.currentTarget.id).data('userrating'));
    },
});
