const express = require('express');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.json());

const microsoftDB = './microsoftUsers.json';
const atlassianDB = './atlassianUsers.json';

const microsoftApiToken = 'microsoft-fake-api-token';
const atlassianApiToken = 'atlassian-fake-api-token';

const checkMicrosoftAuth = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token === `Bearer ${microsoftApiToken}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized - Invalid API Token' });
  }
};

const checkAtlassianAuth = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token === `Bearer ${atlassianApiToken}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized - Invalid API Token' });
  }
};

const loadData = (filePath) => {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath));
  }
  return [];
};

const saveData = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// ---------------------- MICROSOFT ---------------------- //

// POST
app.post('/microsoft/users', checkMicrosoftAuth, (req, res) => {
  const { displayName, mailNickname, userPrincipalName, passwordProfile } = req.body;
  if (!displayName || !mailNickname || !userPrincipalName || !passwordProfile) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const users = loadData(microsoftDB);
  const existing = users.find(u => u.userPrincipalName === userPrincipalName);
  if (existing) {
    return res.status(409).json({ error: 'User with this userPrincipalName already exists' });
  }

  const newUser = {
    id: users.length + 1,
    displayName,
    mailNickname,
    userPrincipalName,
    accountEnabled: true,
    passwordProfile
  };
  users.push(newUser);
  saveData(microsoftDB, users);
  res.status(201).json(newUser);
});


// GET
app.get('/microsoft/users', checkMicrosoftAuth, (req, res) => {
  const users = loadData(microsoftDB);
  res.status(200).json({ value: users });
});

// PATCH (Update)
app.patch('/microsoft/users/:id', checkMicrosoftAuth, (req, res) => {
  const { id } = req.params;
  let users = loadData(microsoftDB);
  const index = users.findIndex(u => u.id == id);
  if (index === -1) return res.status(404).json({ error: 'User not found' });

  users[index] = { ...users[index], ...req.body };
  saveData(microsoftDB, users);
  res.status(200).json(users[index]);
});

// DELETE
app.delete('/microsoft/users/:id', checkMicrosoftAuth, (req, res) => {
  const { id } = req.params;
  let users = loadData(microsoftDB);
  const index = users.findIndex(u => u.id == id);
  if (index === -1) return res.status(404).json({ error: 'User not found' });

  const deletedUser = users.splice(index, 1);
  saveData(microsoftDB, users);
  res.status(204).send(); // Microsoft Graph returns 204 No Content
});

// ---------------------- ATLASSIAN ---------------------- //

// POST invitation
app.post('/atlassian/orgs/:orgId/invitations', checkAtlassianAuth, (req, res) => {
  const { orgId } = req.params;
  const { email, displayName } = req.body.user;
  if (!email || !displayName) {
    return res.status(400).json({ error: 'Missing user details' });
  }

  const users = loadData(atlassianDB);
  const existing = users.find(u => u.email === email);
  if (existing) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  const newUser = {
    id: users.length + 1,
    email,
    displayName,
    orgId,
    invited: true
  };
  users.push(newUser);
  saveData(atlassianDB, users);
  res.status(201).json({ message: 'User invited', user: newUser });
});


// GET invited users
app.get('/atlassian/orgs/:orgId/invitations', checkAtlassianAuth, (req, res) => {
  const { orgId } = req.params;
  const users = loadData(atlassianDB).filter(u => u.orgId === orgId && u.invited);
  res.status(200).json({ values: users });
});

// Jira
app.post('/atlassian/jira/:cloudId/rest/api/3/user', checkAtlassianAuth, (req, res) => {
  const { emailAddress, displayName } = req.body;
  const users = loadData(atlassianDB);
  const user = users.find(u => u.email === emailAddress);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.jiraAssigned = true;
  saveData(atlassianDB, users);
  res.status(200).json({ message: 'User added to Jira', user });
});
app.get('/atlassian/jira/:cloudId/rest/api/3/user/search', checkAtlassianAuth, (req, res) => {
  const users = loadData(atlassianDB).filter(u => u.jiraAssigned);
  res.status(200).json(users);
});

// Confluence
app.post('/atlassian/confluence/:cloudId/wiki/rest/api/user', checkAtlassianAuth, (req, res) => {
  const { email, displayName } = req.body;
  const users = loadData(atlassianDB);
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.confluenceAssigned = true;
  saveData(atlassianDB, users);
  res.status(200).json({ message: 'User added to Confluence', user });
});
app.get('/atlassian/confluence/:cloudId/wiki/rest/api/user', checkAtlassianAuth, (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Missing email query param' });
  const users = loadData(atlassianDB);
  const user = users.find(u => u.email === email && u.confluenceAssigned);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.status(200).json(user);
});

// PUT (Update user - simulated)
app.put('/atlassian/users/:email', checkAtlassianAuth, (req, res) => {
  const { email } = req.params;
  const users = loadData(atlassianDB);
  const index = users.findIndex(u => u.email === email);
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  users[index] = { ...users[index], ...req.body };
  saveData(atlassianDB, users);
  res.status(200).json({ message: 'User updated', user: users[index] });
});

// DELETE (Simulated delete by email)
app.delete('/atlassian/users/:email', checkAtlassianAuth, (req, res) => {
  const { email } = req.params;
  let users = loadData(atlassianDB);
  const index = users.findIndex(u => u.email === email);
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  users.splice(index, 1);
  saveData(atlassianDB, users);
  res.status(204).send(); // Simulate Atlassian delete response
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Fake API Server running at http://localhost:${port}`);
});
