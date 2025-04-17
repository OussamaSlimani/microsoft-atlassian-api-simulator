const express = require('express');
const fs = require('fs');
const app = express();
const port = 3000;

// Middleware to parse JSON body
app.use(express.json());

// Fake databases (JSON files)
const microsoftDB = './microsoftUsers.json';
const atlassianDB = './atlassianUsers.json';

// Simulated API Tokens
const microsoftApiToken = 'microsoft-fake-api-token';
const atlassianApiToken = 'atlassian-fake-api-token';

// Middleware to check API token for Microsoft
const checkMicrosoftAuth = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token === `Bearer ${microsoftApiToken}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized - Invalid API Token' });
  }
};

// Middleware to check API token for Atlassian
const checkAtlassianAuth = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token === `Bearer ${atlassianApiToken}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized - Invalid API Token' });
  }
};

// Load the data from the files if they exist
const loadData = (filePath) => {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath));
  }
  return [];
};

// Simulating Microsoft API: Create User
app.post('/microsoft/users', checkMicrosoftAuth, (req, res) => {
  const { displayName, mailNickname, userPrincipalName, passwordProfile } = req.body;

  if (!displayName || !mailNickname || !userPrincipalName || !passwordProfile) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const users = loadData(microsoftDB);
  const newUser = {
    displayName,
    mailNickname,
    userPrincipalName,
    passwordProfile,
    id: users.length + 1, // Fake ID for the user
  };

  users.push(newUser);
  fs.writeFileSync(microsoftDB, JSON.stringify(users, null, 2));

  res.status(201).json(newUser);
});

// Simulating Atlassian API: Invite User
app.post('/atlassian/orgs/:orgId/invitations', checkAtlassianAuth, (req, res) => {
  const { orgId } = req.params;
  const { email, displayName } = req.body.user;

  if (!email || !displayName) {
    return res.status(400).json({ error: 'Missing user details' });
  }

  const atlassianUsers = loadData(atlassianDB);
  const newUser = {
    email,
    displayName,
    orgId,
    id: atlassianUsers.length + 1, // Fake ID for the user
  };

  atlassianUsers.push(newUser);
  fs.writeFileSync(atlassianDB, JSON.stringify(atlassianUsers, null, 2));

  res.status(201).json({ message: 'User invited', user: newUser });
});

// Simulating adding user to Jira
app.post('/atlassian/jira/:cloudId/rest/api/3/user', checkAtlassianAuth, (req, res) => {
  const { cloudId } = req.params;
  const { emailAddress, displayName } = req.body;

  if (!emailAddress || !displayName) {
    return res.status(400).json({ error: 'Missing user details' });
  }

  const atlassianUsers = loadData(atlassianDB);
  const user = atlassianUsers.find((u) => u.email === emailAddress);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.jiraAssigned = true;
  fs.writeFileSync(atlassianDB, JSON.stringify(atlassianUsers, null, 2));

  res.status(200).json({ message: 'User added to Jira', user });
});

// Simulating adding user to Confluence
app.post('/atlassian/confluence/:cloudId/wiki/rest/api/user', checkAtlassianAuth, (req, res) => {
  const { cloudId } = req.params;
  const { email, displayName } = req.body;

  if (!email || !displayName) {
    return res.status(400).json({ error: 'Missing user details' });
  }

  const atlassianUsers = loadData(atlassianDB);
  const user = atlassianUsers.find((u) => u.email === email);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.confluenceAssigned = true;
  fs.writeFileSync(atlassianDB, JSON.stringify(atlassianUsers, null, 2));

  res.status(200).json({ message: 'User added to Confluence', user });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
