## TLDR
Immediately notifies you of high-urgency emails and otherwise, sends you an hourly email digest.

## Problem
I get dozens or even hundreds of emails every day. As a college student, most of the time, it's a random email list that is entirely irrelevant to me but because I need to know about urgent emails (ex: last second reschedule, important update, etc), I can't just turn off or delay email notifications.

## Solution
This webapp intercepts your emails and uses an LLM to identify the priority of the email. If high priority, it will immediately send you a text about the email, and otherwise, will schedule a message on the hour about all the lower-priority emails you've received.

## Setup
`npm i` installs the necessary packages and `npm run dev` runs the app locally. Note this project is built on top of [Convex](https://www.convex.dev/) and running locally or deploying it would require an account there.