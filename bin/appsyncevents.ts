#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { AppsynceventsStack } from "../lib/appsyncevents-stack.js";

const app = new App();
new AppsynceventsStack(app, "AppsynceventsStack", {});