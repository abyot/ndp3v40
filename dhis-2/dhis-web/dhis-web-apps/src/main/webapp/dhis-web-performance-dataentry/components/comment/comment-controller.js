/* global angular, ndpPerformanceDataEntry */

'use strict';


ndpPerformanceDataEntry.controller('CommentController',
        function($scope,
                $modalInstance,
                $translate,
                $window,
                $filter,
                DHIS2URL,
                dataValues,
                selectedOrgUnit,
                selectedPeriod,
                dataElement,
                selectedCategoryCombo,
                selectedCategoryOptionCombo,
                selectedAttributeCategoryCombo,
                dataSetCompleteness,
                CommonUtils,
                DateUtils,
                MetaDataFactory,
                DataValueService,
                NotificationService,
                ModalService,
                EventService,
                FileService){

    $scope.saveStatus = {};
    $scope.dataValues = dataValues;
    $scope.selectedOrgUnit = selectedOrgUnit;
    $scope.selectedPeriod = selectedPeriod;
    $scope.selectedDataElement = dataElement;
    $scope.selectedCategoryCombo = selectedCategoryCombo;
    $scope.selectedCategoryOptionCombo = selectedCategoryOptionCombo;
    $scope.selectedAttributeCategoryCombo = selectedAttributeCategoryCombo;
    $scope.dataSetCompleteness = dataSetCompleteness;
    $scope.model = {
        fileInput: {},
        fileDataElement: null,
        comment: {},
        documents: {}
    };

    if ( $scope.selectedAttributeCategoryCombo && $scope.selectedAttributeCategoryCombo.categoryOptionCombos ){
        var eventIds = [];
        angular.forEach($scope.selectedAttributeCategoryCombo.categoryOptionCombos, function(aoc){
            var comment = null;
            if ( $scope.dataValues[$scope.selectedDataElement.id] &&
                    $scope.dataValues[$scope.selectedDataElement.id][$scope.selectedCategoryOptionCombo.id] &&
                    $scope.dataValues[$scope.selectedDataElement.id][$scope.selectedCategoryOptionCombo.id][aoc.id] ){
                comment = $scope.dataValues[$scope.selectedDataElement.id][$scope.selectedCategoryOptionCombo.id][aoc.id].comment;
            }
            if( comment ){
                $scope.model.comment[aoc.id] =  JSON.parse( comment );
                if ( $scope.model.comment[aoc.id].attachment ){
                    angular.forEach($scope.model.comment[aoc.id].attachment, function(att){
                        if( eventIds.indexOf( att ) === -1){
                            eventIds.push(att);
                        }
                    });
                }
            }
        });

        if( eventIds.length > 0 ){
            EventService.getMultiple( eventIds ).then(function(docs){
                $scope.model.documents = docs;
            });
        }
    }

    MetaDataFactory.getByProperty('programs', 'documentFolderType', 'indicator').then(function(program){
        if( !program ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_indicator_document_folder"));
            return;
        }

        $scope.model.selectedProgram = program;

        $scope.model.selectedProgramStage = $scope.model.selectedProgram.programStages[0];

        var docDe = $filter('filter')($scope.model.selectedProgramStage.programStageDataElements[0], {dataElement: {valueType: 'FILE_RESOURCE'}});

        if ( !$scope.model.selectedProgramStage || !docDe || !docDe.dataElement){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_indicator_document_folder_configuration"));
            return;
        }

        $scope.model.fileDataElement = docDe.dataElement;
    });

    var processComment = function(){
        for( var key in $scope.model.comment ){
            var comment = $scope.model.comment[key];
            if( comment ){
                $scope.dataValues[$scope.selectedDataElement.id][$scope.selectedCategoryOptionCombo.id][key].comment = JSON.stringify( comment );
            }
        }
    };

    $scope.close = function () {
        processComment();
        $modalInstance.close( $scope.dataValues );
    };

    $scope.saveComment = function( aoc ){

        $scope.saveStatus[ $scope.selectedDataElement.id + '-' + $scope.selectedCategoryOptionCombo.id + '-' + aoc.id ] = {saved: false, pending: true, error: false};

        var clearComment = false;
        if( $scope.model.comment[aoc.id] && $scope.model.comment[aoc.id].explanation && $scope.model.comment[aoc.id].explanation === ""){
            delete $scope.model.comment[aoc.id].explanation;
        }

        if( $scope.model.comment[aoc.id] && !$scope.model.comment[aoc.id].explanation && !$scope.model.comment[aoc.id].attachment){
            clearComment = true;
        }

        var dataValue = {ou: $scope.selectedOrgUnit.id,
                    pe: $scope.selectedPeriod.id,
                    de: $scope.selectedDataElement.id,
                    co: $scope.selectedCategoryOptionCombo.id,
                    comment: clearComment ? "" : JSON.stringify( $scope.model.comment[aoc.id] )
                };
        if( $scope.selectedAttributeCategoryCombo && !$scope.selectedAttributeCategoryCombo.isDefault ){
            dataValue.cc = $scope.selectedAttributeCategoryCombo.id;
            dataValue.cp = CommonUtils.getOptionIds(aoc.categoryOptions);
        }

        DataValueService.saveComment( dataValue ).then(function(response){
            $scope.saveStatus[$scope.selectedDataElement.id + '-' + $scope.selectedCategoryOptionCombo.id + '-' + aoc.id].saved = true;
            $scope.saveStatus[$scope.selectedDataElement.id + '-' + $scope.selectedCategoryOptionCombo.id + '-' + aoc.id].pending = false;
            $scope.saveStatus[$scope.selectedDataElement.id + '-' + $scope.selectedCategoryOptionCombo.id + '-' + aoc.id].error = false;
        }, function(){
            $scope.saveStatus[$scope.selectedDataElement.id + '-' + $scope.selectedCategoryOptionCombo.id + '-' + aoc.id].saved = false;
            $scope.saveStatus[$scope.selectedDataElement.id + '-' + $scope.selectedCategoryOptionCombo.id + '-' + aoc.id].pending = false;
            $scope.saveStatus[$scope.selectedDataElement.id + '-' + $scope.selectedCategoryOptionCombo.id + '-' + aoc.id].error = true;
        });
    };

    $scope.getInputNotifcationClass = function(deId, ocId, aocId){

        var currentElement = $scope.saveStatus[deId + '-' + ocId + '-' + aocId];
        if( currentElement ){
            if(currentElement.pending){
                return 'form-control input-pending';
            }

            if(currentElement.saved){
                return 'form-control input-success';
            }
            else{
                return 'form-control input-error';
            }
        }

        return 'form-control';
    };

    $scope.isDisabled = function( aoc ){
        return !aoc.dWrite || $scope.dataSetCompleteness;
    };

    $scope.cancelUpload = function( aoc ){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'warning',
            bodyText: 'are_you_sure_to_cancel_file_upload'
        };

        ModalService.showModal({}, modalOptions).then(function(result){
            $scope.model.fileInput[aoc] = null;
        });
    };

    $scope.uploadFile = function( aoc ){

        if( !aoc || !aoc.id || !$scope.model.fileInput[aoc.id] || $scope.model.fileInput[aoc.id].length === 0){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("no_files_to_upload"));
            return;
        }

        var today = DateUtils.getToday();
        var username = CommonUtils.getUsername();

        angular.forEach($scope.model.fileInput[aoc.id], function(f){

            FileService.upload(f).then(function(fileRes){

                if(fileRes && fileRes.status === 'OK' && fileRes.response && fileRes.response.fileResource && fileRes.response.fileResource.id && fileRes.response.fileResource.name){
                    var dataValues = [{
                        dataElement: $scope.model.fileDataElement.id,
                        value: fileRes.response.fileResource.id
                    }];

                    var ev = {
                        program: $scope.model.selectedProgram.id,
                        programStage: $scope.model.selectedProgramStage.id,
                        orgUnit: $scope.selectedOrgUnit.id,
                        status: 'ACTIVE',
                        eventDate: today,
                        dataValues: dataValues
                    };

                    EventService.create(ev).then(function(eventRes){
                        if (eventRes.response.importSummaries[0].status === 'ERROR') {
                            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("file_upload_failed") + f.name );
                            return;
                        }
                        else {
                            //add newly added file to the grid
                            var d = {
                                dateUploaded: today,
                                uploadedBy: username,
                                event: eventRes.response.importSummaries[0].reference,
                                value: fileRes.response.fileResource.id,
                                name: f.name,
                                size: $filter('fileSize')(f.size),
                                path: '/events/files?dataElementUid=' + $scope.model.fileDataElement.id + '&eventUid=' + eventRes.response.importSummaries[0].reference
                            };

                            if ( !$scope.model.comment[aoc.id] ){
                                $scope.model.comment[aoc.id] = {attachment: []};
                            }
                            else if( !$scope.model.comment[aoc.id].attachment ){
                                $scope.model.comment[aoc.id].attachment = [];
                            }

                            $scope.model.comment[aoc.id].attachment.push( eventRes.response.importSummaries[0].reference );

                            $scope.model.documents[d.event] = d;
                            $scope.saveComment( aoc );
                        }
                    });
                }
                else{
                    NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("file_upload_failed") + f.name );
                    return;
                }
            });
        });
    };

    $scope.interacted = function(field) {
        var status = false;
        if(field){
            status = $scope.outerForm.submitted || field.$dirty;
        }
        return status;
    };

    $scope.downloadFile = function(path, e){
        if( path ){
            $window.open(DHIS2URL + path, '_blank', '');
        }
        if(e){
            e.stopPropagation();
            e.preventDefault();
        }
    };

    $scope.deleteFile = function(document, aoc, e){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'warning',
            bodyText: 'are_you_sure_to_delete_file'
        };

        ModalService.showModal({}, modalOptions).then(function(result){
            if( document ){
                EventService.deleteEvent(document).then(function(data){
                    delete $scope.model.documents[document.event];
                    if( $scope.model.comment[aoc.id] && $scope.model.comment[aoc.id].attachment ){
                        for( var i=0; i< $scope.model.comment[aoc.id].attachment.length; i++ ){
                            if( $scope.model.comment[aoc.id].attachment[i] === document.event ){
                                $scope.model.comment[aoc.id].attachment.splice(i, 1);
                                if( $scope.model.comment[aoc.id].attachment.length === 0 ){
                                    delete $scope.model.comment[aoc.id].attachment;
                                }
                                $scope.saveComment( aoc );
                                return;
                            }
                        }
                    }

                });
            }
            if(e){
                e.stopPropagation();
                e.preventDefault();
            }
        });
    };
});