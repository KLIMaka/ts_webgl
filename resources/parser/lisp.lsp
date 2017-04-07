(set \ lambda)
(set strlen (evaljs "return evaluate(l.head()).length"))
(set tostr (evaljs "return evaluate(l.head()) + ''"))
(set concat (evaljs "return evaluate(l.get(0)) + '' + evaluate(l.get(1))"))

(set rev (\ l
	(if (length l)
		(append (rev (rest l)) (list (head l)))
		`()
	)
))

(set nth (\ l n
  (if n
    (nth (rest l) (+ n -1))
    (head l)
  )
))

(set filter (\ l f
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

(set qsort (\ l
  (let
    nonempty (length l)
    pivot    (head l)
    pred     (\ op (op _0 pivot))
    ls       (filter l (pred <))
    eq       (filter l (pred ==))
    gt       (filter l (pred >))

    (if nonempty
      (append 
        (qsort ls) 
        eq 
        (qsort gt)
      )
      `()
    )
  )
))

(qsort `(4 8 4 2 6 5 4 4 7 5 2 54 4 7 4 4 7 5 4 1 1 2 5 4 4 8 5 4 4 4 5 6 99 3 2 1 4))

(set match (\ arg ms
  (let
    nonempty (length ms)
    first    (head ms)
    result   ((head (rest ms)))
    tail     (rest (rest ms))
    cond     (first arg)
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

(set reduce (\ f l
  (match (length l) (list
    (== _0 0) (\ 0)
    (== _0 1) (\ (head l))
    (!= _0 1) (\ (f (head l) (reduce f (rest l))))
  ))
))

(set left_subtree  (\ t (head t)))
(set right_subtree (\ t (head (rest (rest t)))))
(set node_value    (\ t (head (rest t))))

(set tree_add (\ t e 
  (let
    nonempty (length t)
    left     (left_subtree t)
    value    (node_value t)
    right    (right_subtree t)

    (if nonempty
      (match value (list
        (== _0 e) (\ t)
        (>  _0 e) (\ (list (tree_add left e) value right))
        (<  _0 e) (\ (list left value (tree_add right e)))
      ))
      (list `() e `())
    )
  )
))

(set build_tree (\ l t
  (let 
    nonempty (length l)
    first    (head l)
    tail     (rest l)
    addnode  (tree_add t first)

    (if nonempty
      (build_tree tail addnode)
      t
    )
  )
))

(set visit_tree (\ t
  (let
    nonempty (length t)
    tail     (rest t)
    left     (visit_tree (left_subtree t))
    right    (visit_tree (right_subtree t))
    nodeval  (list (node_value t))

    (if nonempty
      (append left nodeval right)
      `()
    )
  )
))

(set max (\ a b
  (if (>= a b) a b)
))

(set tree_height (\ t
  (let
    nonempty (length t)
    left     (+ 1 (tree_height (left_subtree t)))
    right    (+ 1 (tree_height (right_subtree t)))

    (if nonempty
      (max left right)
      0
    )
  )
))

(set tree (build_tree (rev `(10 55 87 4 5 45 9 88 4 66 8 5 4 55 9 5 1 2 5 4 77  4)) `()))
(reduce (tree_add _1 _0) `(10 55 87 4 5 45 9 88 4 66 8 5 4 55 9 5 1 2 5 4 77  4 ()))
(tree_height tree)
(rev (visit_tree tree))

(set genspaces (\ n 
  (if n
    (concat " " (genspaces (+ n -1)))
    ""
  )
))

(set print_tree (\ t
  (let
    left (strlen )
    ()
  )
))

(reduce concat `("1" "2" "3" "4"))
