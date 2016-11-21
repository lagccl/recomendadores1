import {Meteor} from "meteor/meteor";
import {Mongo} from "meteor/mongo";
import {check} from "meteor/check";

export const Ratings = new Mongo.Collection('ratings');

if (Meteor.isServer) {
    Meteor.publish('ratings', function ratingsPublication() {
        return Ratings.find({});
    });
}

Meteor.methods({
    'rating.insert'(postId, email, method, rating) {
        check(email, String);
        Ratings.insert({
            postId: postId,
            createdAt: new Date(),
            email: email,
            method: method,
            rating: rating
        });
    },
    'rating.removeAll'(email) {
        check(email, String);
        Ratings.remove({
            email: email
        });
    },
});
