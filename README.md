# Web Development Project 7 - *NeonChrome*

Submitted by: **Therese Virata**

This web app: **Allows users to make different Cyberpunk 2077 builds.**

Time spent: **3** hours spent in total

## Required Features

The following **required** functionality is completed:


- [X] **The web app contains a page that features a create form to add a new build**
  - Users can name the build
  - Users can set the build attributes by clicking on one of several values
- [X] **The web app includes a summary page of all the user’s added build**
  -  The web app contains a summary page dedicated to displaying all the build's the user has made so far
  -  The summary page is sorted by creation date such that the most recently created builds appear at the top
- [X] **A previously created build can be updated from the list of builds in the summary page**
  - Each build has an edit button that will take users to an update form for the relevant build
  - Users can see the current attributes of their build on the update form
  - After editing the build's attribute values using the form, the user can immediately see those changes reflected in the update form and on the summary page 
- [X] **A previously created crebuildwmate can be deleted from the build list**
  - Using the edit form detailed in the previous build can be updated_ feature, there is a button that allows users to delete that v
  - After deleting a build, the build should no longer be visible in the summary page
  - [X] **Each build has a direct, unique URL link to an info page about them**
    - Clicking on a build in the summary page navigates to a detail page for that build
    - The detail page contains extra information about the build not included in the summary page
    - Users can navigate to to the edit form from the detail page

The following **optional** features are implemented:

- [X] A build can be given a category upon creation which restricts their attribute value options
  - e.g., a Dungeons and Dragons class or a development team role (project manager, product owner, etc.)
  - User can choose a `category` option to describe their crewmate before any attributes are specified
  - Based on the category value, users are allowed to access only a subset of the possible attributes

## Video Walkthrough

Here's a walkthrough of implemented user stories:

<img src='cyberpunk-builds\src\assets\walkthrough.gif' title='Video Walkthrough' width='' alt='Video Walkthrough' />

<!-- Replace this with whatever GIF tool you used! -->
GIF created with ScreenToGif  
<!-- Recommended tools:
[Kap](https://getkap.co/) for macOS
[ScreenToGif](https://www.screentogif.com/) for Windows
[peek](https://github.com/phw/peek) for Linux. -->

## Notes

It was difficult for me to find an open API with all the different cyberware available in Cyberpunk 2077. There are just so many different implants, I instead had AI implement a list of selected implants found in the official fandom Wiki for Cyberpunk 2077. I wish to add more but I am satisfied with the list now.

## License

    Copyright 2026 Therese Virata

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.