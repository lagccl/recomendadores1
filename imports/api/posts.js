import {Mongo} from "meteor/mongo";

export const Posts = new Mongo.Collection('posts');

Posts.reddit = 'REDDIT';
Posts.stackExchange = 'STACK_EXCHANGE';