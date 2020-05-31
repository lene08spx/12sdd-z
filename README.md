# The Z Programming Language
An exercise in writing a compiler.

## Installation
1. Windows Computer Required

## Exercise One: *Hello, World!*
```st
PROG ONE
  OUT["Hello, World"]:
ENDPROG
```

## Exercise Two: *Mathematics*
```st
PROG TWO
  = X1 2:
  = X1 4 *:
  OUT["X1 = (2*4) = "+X1]:
ENDPROG
```

## Example: *FizzBuzz*
```st
PROG FIZZBUZZ
  = X3 1:
  = X5 1:
  = I1 1:
  = M1 IN["MAX : "]:
  WHEN <= I1 M1 DO
    = O1 0:
    IF AND >= X5 5 >= X3 3 DO
      OUT["FIZZ BUZZ"]:
      = X3 0:
      = X5 0:
      = O1 1:
    ENDDO ENDIF
    IF AND >= X3 3 == O1 0 DO
      OUT["FIZZ"]:
      = X3 0:
      = O1 1:
    ENDDO ENDIF
    IF AND >= X5 5 == O1 0 DO
      OUT["BUZZ"]:
      = X5 0:
      = O1 1:
    ENDDO ENDIF
    IF == O1 0 DO
      OUT[I1]:
    ENDDO ENDIF
    = X3 1 +:
    = X5 1 +:
    = I1 1 +:
  ENDDO ENDWHEN
ENDPROG
```

## Example: *Fibonacci*
```st
PROG FIBONACCI
 = N1 IN["NO. OF TERMS : "]:
 = C1 1:
 = F0 0:
 = F1 1:
 = F2 1:
 OUT[" F( 0 ) = 0"]:
 WHEN <= C1 N1 DO
  OUT[" F( "+C1+" ) ="+F2]:
  = F2 0:
  = F2 F0+:
  = F2 F1+:
  = F0 F1:
  = F1 F2:
  = C1 1 +:
 ENDDO ENDWHEN
ENDPROG
```
