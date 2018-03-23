'use strict';
/**
 * Write your transction processor functions here
 */

 // util functions
 function guid() {
    function S4() {
      return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    }
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
  }

/**
 * An application for student loan transaction definition
 * @param {org.hku.niko.loan.ApplyLoan} applyLoanRequest - the loan application transaction
 * @transaction
 */
function applyLoanTransaction(applyLoanRequest) {
    console.log('applyLoan');
    var factory = getFactory();
    var NS = "org.hku.niko.loan";
    var student = applyLoanRequest.student;
    var professor = applyLoanRequest.professor;
    var application;
    
    return getAssetRegistry(NS + '.Application')
    .then(function (applicationRegistry) {
        // add the temp reading to the shipment
        console.log(applyLoanRequest);
        
        if (student.uid) {
            //create a loan application
            application = factory.newResource(NS, 'Application', guid());
            application.applicationStatus = 'CREATED';
            if (applyLoanRequest.loanValue <= 0) {
                throw new Error("The loan value must be positive");
            }
            application.loanValue = applyLoanRequest.loanValue;
            application.student = student;
            application.professor = professor;
                   
            var applyLoanEvent = factory.newEvent(NS, 'ApplyLoanEvent');
            applyLoanEvent.student = student;
            var message = 'Application[' + application.applicationId + '] ==> Student[' + applyLoanRequest.student.uid + "] is applying HKU student loan";
            applyLoanEvent.message = message;
            console.log(message);
            emit(applyLoanEvent);
            return applicationRegistry.addAll([application]);
        }
        return applicationRegistry;
    })
    .then(function() {
        return getParticipantRegistry(NS + '.Student');
    })
    .then(function(studentRegistry) {
        // update student registry
        return studentRegistry.update(student);
    })
    .then(function() {
        return getParticipantRegistry(NS + '.Professor');
    })
    .then(function(professorRegistry) {
        // update professor registry
        return professorRegistry.update(professor);
    })
    .catch(function (error) {
        console.log(error);
    });
}

/**
 * Update the status of a loan
 * @param {org.hku.niko.loan.UpdateLoanStatus} updateLoanStatusRequest - the UpdateLoanStatus transaction
 * @transaction
 */
function updateLoanStatusTransaction(updateLoanStatusRequest) {
    console.log('updateLoanStatus');

    var factory = getFactory();
    var NS = 'org.hku.niko.loan';

    var application = updateLoanStatusRequest.application;
    var currentStatus = application.applicationStatus;
    //create a student loan
    var loan = factory.newResource(NS, 'Loan', guid());
    loan.application = application;
    loan.value = application.loanValue;
    loan.loanStatus = 'INACTIVATED';

    switch(currentStatus) {
        case 'CREATED':
            return getParticipantRegistry(NS + '.Professor')
            .then(function(professorRegistry) {
                console.log("professor section");
                
                if (!updateLoanStatusRequest.professor) {
                    throw new Error("Professor is not assigned");
                }

                if (application.professor.uid != updateLoanStatusRequest.professor.uid) {
                    throw new Error("Professor is not matched with the assigned supervisor");
                }

                var professor = updateLoanStatusRequest.professor;
                if (currentStatus == 'CREATED') {
                    application.applicationStatus = 'PROFESSOR_AUDIT';
                }
                return professorRegistry.update(professor);
            })
            .then(function() {
                return getAssetRegistry(NS + '.Application');
            })
            .then(function(applicationRegistry) {
                console.log("application section");
                console.log(application);
                return applicationRegistry.update(application);
            })
            .catch(function(error) {
                console.log(error);
            });
            break;
        case 'PROFESSOR_AUDIT':
            return getParticipantRegistry(NS + '.Bank')
            .then(function(bankRegistry) {
                console.log("bank section");

                if (!updateLoanStatusRequest.bank) {
                    throw new Error("Bank is not assigned");
                }
                var bank = updateLoanStatusRequest.bank;
                if (currentStatus == 'PROFESSOR_AUDIT') {
                    if (bank.expectedLoanValue > application.loanValue) {
                        application.applicationStatus = 'SUCCESSED';
                        loan.loanStatus = 'ACTIVATED';
                        loan.bank = bank;
                    } else {
                        application.applicationStatus = 'FAILED';
                    }
                }
                return bankRegistry.update(bank);
            })
            .then(function() {
                return getAssetRegistry(NS + '.Loan');
            })
            .then(function(loanRegistry) {
                console.log("loan section");
                return loanRegistry.addAll([loan]);
            })
            .then(function() {
                return getAssetRegistry(NS + '.Application');
            })
            .then(function(applicationRegistry) {
                console.log("application section");
                console.log(application);
                return applicationRegistry.update(application);
            })
            .catch(function(error) {
                console.log(error);
            });
            break;
        default:
            console.log("default operation");
    }
}

/**
 * Create the participants to use in the project
 * @param {org.hku.niko.loan.SetupDemo} setup - the setup transaction
 * @transaction
 */
function setupDemo(setup) {
    console.log('setup');
 
    var factory = getFactory();
    var NS = 'org.hku.niko.loan';

    // create student
    var student = factory.newResource(NS, 'Student', '3035348554');
    student.name = 'Niko Feng';
    student.email = 'nikofeng@hku.hk';
    var studentDept = factory.newConcept(NS, 'Department');
    studentDept.deptId = 'ENGEERING_001';
    studentDept.deptName = 'Computer Science Department';
    student.dept = studentDept;

    // create professor
    var professor = factory.newResource(NS, 'Professor', '0000000001');
    professor.name = 'S.M. Yiu';
    professor.email = 'smyiu@hku.hk';
    var profDept = factory.newConcept(NS, 'Department');
    profDept.deptId = 'ENGEERING_001';
    profDept.deptName = 'Computer Science Department';
    professor.dept = profDept;

    // create bank regulator
    var bank = factory.newResource(NS, 'Bank', 'BANK_001');
    bank.bankName = 'HSBC';
    bank.expectedLoanValue = 1000;
    
    // create the loan applied by the student
    // var loan = factory.newResource(NS, 'Loan', 'LOAN_001');
    // loan.student = factory.newRelationship(NS, 'Student', 'nikofeng@hku.hk');
    // loan.bank = factory.newRelationship(NS, 'Bank', 'BANK_001');
    // loan.loanStatus = 'CREATED';

    return getParticipantRegistry(NS + '.Student')
        .then(function (studentRegistry) {
            // add the student
            return studentRegistry.addAll([student]);
        })
        .then(function() {
            return getParticipantRegistry(NS + '.Professor');
        })
        .then(function(professorRegistry) {
            // add the professor
            return professorRegistry.addAll([professor]);
        })
        .then(function() {
            return getParticipantRegistry(NS + '.Bank');
        })
        .then(function(bankRegistry) {
            // add the bank regulator
            return bankRegistry.addAll([bank]);
        });
    }