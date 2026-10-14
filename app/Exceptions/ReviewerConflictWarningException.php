<?php

namespace App\Exceptions;

/** A selected blind reviewer may have a conflict of interest; the officer can confirm and assign anyway. */
class ReviewerConflictWarningException extends \InvalidArgumentException {}
