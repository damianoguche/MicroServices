- Since each DB is in its own Mongo container, you access them container-by-container.

## Access via Docker exec

### User Service DB

```
docker exec -it user-mongo mongosh
```

```
show dbs
use users
show collections
db.users.find()
```

### Task Service DB

```
docker exec -it task-mongo mongosh
```

```
show dbs
use tasks
show collections
db.tasks.find()
```

## Access from host machine (via exposed ports)

- Exposed ports

```
user-mongo  -> 27071
task-mongo  -> 27072
```

- User DB

user-mongo or task-mongo is a Docker service name.
Docker service names are ONLY resolvable inside the Docker network.
Your host machine does not know what user-mongo or task-mongo is.

```
mongosh "mongodb://localhost:27071"
```

- Task DB

```
mongosh "mongodb://localhost:27072"
```
