(set rev (lambda l
	(if (length l)
		(append (rev (rest l)) (cons (head l) `()))
		`()
	)
))

(set nth (lambda l n
  (if n
    (nth (rest l) (+ n -1))
    (head l)
  )
))

(set filter (lambda l f
  (let 
    nonempty (length l)
    next     (filter (rest l) f)
    first    (head l)
    pred     (f first)

    (if nonempty
      (if pred 
        (cons first next) 
        next
      )
      `()
    )
  )
))

(set qsort (lambda l
  (let
    nonempty (length l)
    pivot    (head l)
    pred     (lambda op p (op _0 p))
    ls       (lambda p (filter l (pred < p)))
    eq       (lambda p (filter l (pred == p)))
    gt       (lambda p (filter l (pred > p)))

    (if nonempty
      (append 
        (qsort (ls pivot)) 
        (eq pivot) 
        (qsort (gt pivot))
      )
      `()
    )
  )
))

(qsort `(4 8 4 2 6 5 4 4 7 5 2 54 4 7 4 4 7 5 4 1 1 2 5 4 4 8 5 4 4 4 5 6 99 3 2 1 4))
(set . (lambda f g
  (lambda a (f (g a)))
))
(set inc (+ _0 1))
(set double (* _0 2))
((. double inc) 1)

(set match (lambda arg ms
  (let
    nonempty (length ms)
    first    (head ms)
    second   (head (rest ms))
    tail     (rest (rest ms))
    cond     ((eval first) arg)
    result   (eval second)
    next     (match arg tail)
   
    (if nonempty
      (if cond
        result
        next
      )
      0
    )
  )
))

(set - (evaljs "return -evaluate(l.get(0))"))
(set rand (evaljs "return Math.random()"))
(- (+ 1 2))
(match (rand) `(
  (> _0 0.5) "gt"
  (< _0 0.5) "le"
))

(let 
  a 12
  b 22
  (+ a b)
)
