/* global angular, dhis2, docLibrary */

'use strict';

//Controller for settings page
ndpFramework.controller('LibraryController',
        function($scope,
                $translate,
                $filter,
                $window,
                $modal,
                NotificationService,
                DocumentService,
                MetaDataFactory,
                OrgUnitFactory,
                DHIS2URL) {

    $scope.model = {
        optionSets: null,
        fileDataElement: null,
        typeDataElement: null,
        descDataElement: null,
        selectedOptionSet: null,
        events: [],
        ndpDocumentFolders: [],
        programDocumentFolders: [],
        selectedNdpDocumentFolder: null,
        selectedProgrammeDocumentFolder: null,
        fileInput: null,
        showFileUpload: false,
        dataElements: [],
        dynamicHeaders: [],
        isProgrammeDocument: false,
        selectedNdpProgram: null,
        programmeDataElement: null
    };

    $scope.model.horizontalMenus = [
        {id: 'ndp_doc', title: 'ndp_documents', order: 1, view: 'components/library/ndp-documents.html', active: true, class: 'main-horizontal-menu'},
        {id: 'prg_doc', title: 'program_documents', order: 2, view: 'components/library/program-documents.html', class: 'main-horizontal-menu'}
    ];

    $scope.model.staticHeaders = [
        {id: 'name', title: 'file_name'},
        {id: 'size', title: 'file_size'},
        {id: 'dateUploaded', title: 'date_uploaded'},
        {id: 'uploadedBy', title: 'uploaded_by'},
        {id: 'mda', title: 'mda'}
    ];

    MetaDataFactory.getAll('optionSets').then(function(optionSets){
        $scope.model.optionSets = optionSets.reduce( function(map, obj){
            map[obj.id] = obj;
            return map;
        }, {});

        MetaDataFactory.getAllByProperty('programs', 'programType', 'without_registration').then(function(programs){
            $scope.model.programs = programs;
            angular.forEach(programs, function(pr){
                if ( pr.documentFolderType === 'general' ){
                    $scope.model.ndpDocumentFolders.push( pr );
                }
                else if ( pr.documentFolderType === 'programme' ){
                    $scope.model.programDocumentFolders.push( pr );
                }
            });

            //Get orgunits for the logged in user
            OrgUnitFactory.getViewTreeRoot().then(function(response) {
                $scope.orgUnits = response.organisationUnits;
                angular.forEach($scope.orgUnits, function(ou){
                    ou.show = true;
                    angular.forEach(ou.children, function(o){
                        o.hasChildren = o.children && o.children.length > 0 ? true : false;
                    });
                });
                $scope.selectedOrgUnit = $scope.orgUnits[0] ? $scope.orgUnits[0] : null;
            });
        });
    });

    //watch for selection of program
    $scope.$watch('model.selectedProgram', function() {
        $scope.model.selectedProgramStage = null;
        $scope.model.selectedOptionSet = null;
        $scope.model.selectedNdpProgram = null;
        $scope.model.isProgrammeDocument = false;
        $scope.model.documents = [];
        if( angular.isObject($scope.model.selectedProgram) && $scope.model.selectedProgram.id){
            $scope.loadProgramDetails();
        }
    });

    $scope.loadProgramDetails = function (){
        $scope.model.selectedProgramStage = null;
        $scope.model.selectedOptionSet = null;
        $scope.model.selectedNdpProgram = null;
        $scope.model.isProgrammeDocument = false;
        $scope.model.documents = [];
        if( $scope.model.selectedProgram && $scope.model.selectedProgram.id && $scope.model.selectedProgram.programStages.length > 0)
        {
            if ( $scope.model.selectedProgram.programStages.length > 1 )
            {
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_document_folder"));
                return;
            }

            $scope.model.selectedProgramStage = $scope.model.selectedProgram.programStages[0];

            var prDes = $scope.model.selectedProgramStage.programStageDataElements;

            var docDe = $filter('filter')(prDes, {dataElement: {valueType: 'FILE_RESOURCE'}});
            var typeDe = $filter('filter')(prDes, {dataElement: {isDocumentFolder: true}});
            var progDe = $filter('filter')(prDes, {dataElement: {isProgrammeDocument: true}});

            if( docDe.length !== 1 || typeDe.length !== 1 ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_document_folder_configuration"));
                return;
            }

            if( progDe.length === 1 ){
                $scope.model.isProgrammeDocument = true;
                $scope.model.programmeDataElement = progDe[0].dataElement;
            };

            $scope.model.fileDataElement = docDe[0].dataElement;
            $scope.model.typeDataElement = typeDe[0].dataElement;
            $scope.model.selectedOptionSet = $scope.model.optionSets[$scope.model.typeDataElement.optionSet.id];

            $scope.model.dynamicHeaders = [];
            $scope.model.dataElements = [];
            angular.forEach(prDes, function(prDe){
                $scope.model.dataElements[prDe.dataElement.id] = prDe.dataElement;
                if( prDe.dataElement.valueType !== 'FILE_RESOURCE' && !prDe.dataElement.isDocumentFolder && !prDe.dataElement.isProgrammeDocument){
                    $scope.model.dynamicHeaders.push(prDe.dataElement);
                }
            });

            if( !$scope.model.selectedOptionSet || $scope.model.selectedOptionSet.lenth === 0 ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_document_types"));
                return;
            }

            $scope.fetchEvents();
        }
    };

    $scope.fetchEvents = function(){

        if( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id && $scope.model.selectedProgram && $scope.model.selectedProgram.id ){

            DocumentService.getByOrgUnitAndProgram($scope.selectedOrgUnit.id,
            'DESCENDANTS',
            $scope.model.selectedProgram.id,
            $scope.model.typeDataElement,
            $scope.model.fileDataElement,
            $scope.model.optionSets,
            $scope.model.dataElements).then(function(events){
                $scope.model.documents = events;
            });
        }
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

    $scope.showOrgUnitTree = function(){
        var modalInstance = $modal.open({
            templateUrl: 'components/outree/orgunit-tree.html',
            controller: 'OuTreeController',
            resolve: {
                orgUnits: function(){
                    return $scope.orgUnits;
                },
                selectedOrgUnit: function(){
                    return $scope.selectedOrgUnit;
                },
                validOrgUnits: function(){
                    return null;
                }
            }
        });

        modalInstance.result.then(function ( selectedOu ) {
            if( selectedOu && selectedOu.id ){
                $scope.selectedOrgUnit = selectedOu;
                $scope.loadProgramDetails();
            }
        });
    };

    $scope.resetView = function(){
        $scope.model.selectedProgram = null;
    };
});
