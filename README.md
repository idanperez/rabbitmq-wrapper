# rabbitmq-wrapper
Rabbitmq wrapper with retry option

### purpose

This is a typescript wrapper for rabbitmq. it's provide an easy way to connect rabbit and start using queues.

The wrapper Assert (create) the exchanges and queue in the consumer automaically according to the settings provided to it.

The wrapper save you writnig alot of code E.g creating the channel, asserting you queues and the most unique thing - its provide retry mechanism.

## How to use it:

Easy to use, all the user need to do is to implment a very light inteface with one method - process.

All the logic of what you want to do with this message goes into that method, and everything else will work automatically.


## The Retry functionality: 

In this wrappe, the mose unique and given-free functionality is the retry mechanism.

The retry mechanism based on dlx (dead-letter-exchange).
On creating a queue, in the background we are auto creating another qeue wuth the suffix '-dlx', configured with 'ttl' (Time to live) of 5 secondes.

If we failed ( explained later) proccesing a message  - the message will auto moved to the seconed queue, where it will died in 5 secondes and than will automatically go back to the end of our geniune queue.

#### Failure cases:
There are few type of failure: 
1) Retry is unneeded - Invalid Message, wont succeed even if we will keep trying for ever.

2) Unexpected Error occourd - We dont know why, the message should be ok, lets give it another try.

3) Temp fail - we are depending on some service/db that is currently down - the message is ok and we dont want to lose it, keep tring forever.

## How it works
Its all based on the result of the process method.
In this module, there are 2 new types of Error(classes that extends Error).

the process method should signal what is the result of the proccessing:

if no error was thrown(without being catch) - we succesfully worked on the message. no retry needed.
if some general Error was thrown - we will do a retry (for a certian amount of times, according to the settings you provided)
if TemperaryError was thrown - we will keep doing retry for ever.
if InvalidMessage was thrown - we wont do a retry.

### UnExpected failure:
For example, some unexpected error occourd and throwen in the proccess method - E.g take an handler of a file (maybe someone else is currently opened this file)

in this case the process will probably(as it should) throw this error, and we will take care do the retry for you, for the certin amount of times you want.

### Invalid Message:
for example, the message tells us to work on specific order, but this order does not exists on our DB. nothing to do here. we just need to ignore this message without even tring again.

### Temp Error:
our db is down - we should have succeded working on this message, but our dependecies are down, we dont want to lose data and ignore messaged that we could have worked on - as long as it happend, keep working forever.


## You control the flow
In your process mehod, you should decide which error( if any) to throw up. we will do the rest for you. and in doing the rest I mean even with tracing and GREAT logs.


this wrapper is auto logging the retry number, how many times did you tried to work on message, in which try did you finally succeded, what happend and what kind of error was occoured. 
Its creating beatiful graphes and visualisations on kibana, and everything is give without any further work
